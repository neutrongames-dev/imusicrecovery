#define _CRT_SECURE_NO_WARNINGS
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <errno.h>
#include <wchar.h>
#include <windows.h>
#include <bcrypt.h>
#include <libimobiledevice/libimobiledevice.h>
#include <libimobiledevice/afc.h>

static char *wide_to_utf8(const wchar_t *value) {
    if (!value) return NULL;
    int size = WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value, -1, NULL, 0, NULL, NULL);
    if (size <= 0) return NULL;
    char *out = (char *)malloc((size_t)size);
    if (!out) return NULL;
    if (WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value, -1, out, size, NULL, NULL) <= 0) {
        free(out);
        return NULL;
    }
    return out;
}

static void json_string(const char *s) {
    putchar('"');
    if (s) {
        for (const unsigned char *p = (const unsigned char *)s; *p; ++p) {
            switch (*p) {
                case '"': fputs("\\\"", stdout); break;
                case '\\': fputs("\\\\", stdout); break;
                case '\b': fputs("\\b", stdout); break;
                case '\f': fputs("\\f", stdout); break;
                case '\n': fputs("\\n", stdout); break;
                case '\r': fputs("\\r", stdout); break;
                case '\t': fputs("\\t", stdout); break;
                default:
                    if (*p < 0x20) printf("\\u%04x", (unsigned int)*p);
                    else putchar(*p);
            }
        }
    }
    putchar('"');
}

static const char *dict_get(char **dict, const char *key) {
    if (!dict || !key) return NULL;
    for (int i = 0; dict[i] && dict[i + 1]; i += 2) {
        if (strcmp(dict[i], key) == 0) return dict[i + 1];
    }
    return NULL;
}

static int open_afc(const char *udid, idevice_t *device, afc_client_t *afc) {
    idevice_error_t idev = idevice_new(device, udid);
    if (idev != IDEVICE_E_SUCCESS || !*device) {
        fprintf(stderr, "Could not open device %s (idevice error %d).\n", udid ? udid : "", idev);
        return 2;
    }
    afc_error_t aerr = afc_client_start_service(*device, afc, "iMusicRecovery");
    if (aerr != AFC_E_SUCCESS || !*afc) {
        fprintf(stderr, "Could not start read-only AFC service: %s (%d). Pair/trust the device first.\n", afc_strerror(aerr), aerr);
        idevice_free(*device);
        *device = NULL;
        return 3;
    }
    return 0;
}

static void close_afc(idevice_t device, afc_client_t afc) {
    if (afc) afc_client_free(afc);
    if (device) idevice_free(device);
}

static int cmd_list(const char *udid, const char *path) {
    idevice_t device = NULL;
    afc_client_t afc = NULL;
    int rc = open_afc(udid, &device, &afc);
    if (rc) return rc;

    char **entries = NULL;
    afc_error_t err = afc_read_directory(afc, path, &entries);
    if (err != AFC_E_SUCCESS || !entries) {
        fprintf(stderr, "AFC list failed for %s: %s (%d).\n", path, afc_strerror(err), err);
        close_afc(device, afc);
        return 4;
    }

    fputs("[", stdout);
    int first = 1;
    for (int i = 0; entries[i]; ++i) {
        const char *name = entries[i];
        if (!name[0] || strcmp(name, ".") == 0 || strcmp(name, "..") == 0) continue;

        size_t n = strlen(path) + strlen(name) + 3;
        char *full = (char *)malloc(n);
        if (!full) continue;
        if (path[0] == '\0' || strcmp(path, "/") == 0) snprintf(full, n, "/%s", name);
        else if (path[strlen(path) - 1] == '/') snprintf(full, n, "%s%s", path, name);
        else snprintf(full, n, "%s/%s", path, name);

        char **info = NULL;
        afc_error_t ierr = afc_get_file_info(afc, full, &info);
        if (ierr == AFC_E_SUCCESS && info) {
            const char *ifmt = dict_get(info, "st_ifmt");
            const char *size = dict_get(info, "st_size");
            const char *mtime = dict_get(info, "st_mtime");
            const char *kind = "other";
            if (ifmt && strcmp(ifmt, "S_IFREG") == 0) kind = "file";
            else if (ifmt && strcmp(ifmt, "S_IFDIR") == 0) kind = "directory";

            if (!first) fputs(",", stdout);
            first = 0;
            fputs("{\"name\":", stdout); json_string(name);
            fputs(",\"path\":", stdout); json_string(full);
            fputs(",\"kind\":", stdout); json_string(kind);
            printf(",\"size\":%llu", (unsigned long long)(size ? strtoull(size, NULL, 10) : 0));
            printf(",\"mtime\":%llu}", (unsigned long long)(mtime ? strtoull(mtime, NULL, 10) : 0));
            afc_dictionary_free(info);
        }
        free(full);
    }
    fputs("]\n", stdout);
    afc_dictionary_free(entries);
    close_afc(device, afc);
    return 0;
}

static int sha_init(BCRYPT_ALG_HANDLE *alg, BCRYPT_HASH_HANDLE *hash, PUCHAR *object, DWORD *object_len) {
    NTSTATUS status;
    DWORD cb = 0;
    status = BCryptOpenAlgorithmProvider(alg, BCRYPT_SHA256_ALGORITHM, NULL, 0);
    if (status < 0) return 0;
    status = BCryptGetProperty(*alg, BCRYPT_OBJECT_LENGTH, (PUCHAR)object_len, sizeof(*object_len), &cb, 0);
    if (status < 0) return 0;
    *object = (PUCHAR)HeapAlloc(GetProcessHeap(), 0, *object_len);
    if (!*object) return 0;
    status = BCryptCreateHash(*alg, hash, *object, *object_len, NULL, 0, 0);
    return status >= 0;
}

static void sha_cleanup(BCRYPT_ALG_HANDLE alg, BCRYPT_HASH_HANDLE hash, PUCHAR object) {
    if (hash) BCryptDestroyHash(hash);
    if (alg) BCryptCloseAlgorithmProvider(alg, 0);
    if (object) HeapFree(GetProcessHeap(), 0, object);
}

static int cmd_pull(const char *udid, const char *remote, const wchar_t *local) {
    idevice_t device = NULL;
    afc_client_t afc = NULL;
    int rc = open_afc(udid, &device, &afc);
    if (rc) return rc;

    uint64_t handle = 0;
    afc_error_t err = afc_file_open(afc, remote, AFC_FOPEN_RDONLY, &handle);
    if (err != AFC_E_SUCCESS || !handle) {
        fprintf(stderr, "AFC open failed for %s: %s (%d).\n", remote, afc_strerror(err), err);
        close_afc(device, afc);
        return 5;
    }

    FILE *out = _wfopen(local, L"wb");
    if (!out) {
        fprintf(stderr, "Could not open local destination: %s\n", strerror(errno));
        afc_file_close(afc, handle);
        close_afc(device, afc);
        return 6;
    }

    BCRYPT_ALG_HANDLE alg = NULL;
    BCRYPT_HASH_HANDLE hash = NULL;
    PUCHAR hash_object = NULL;
    DWORD hash_object_len = 0;
    if (!sha_init(&alg, &hash, &hash_object, &hash_object_len)) {
        fprintf(stderr, "Could not initialize SHA-256.\n");
        fclose(out);
        afc_file_close(afc, handle);
        close_afc(device, afc);
        return 7;
    }

    unsigned char *buf = (unsigned char *)malloc(1024 * 1024);
    if (!buf) {
        fprintf(stderr, "Out of memory.\n");
        sha_cleanup(alg, hash, hash_object);
        fclose(out);
        afc_file_close(afc, handle);
        close_afc(device, afc);
        return 8;
    }

    uint64_t total = 0;
    for (;;) {
        uint32_t got = 0;
        err = afc_file_read(afc, handle, (char *)buf, 1024 * 1024, &got);
        if (err != AFC_E_SUCCESS) {
            fprintf(stderr, "AFC read failed for %s after %llu bytes: %s (%d).\n", remote, (unsigned long long)total, afc_strerror(err), err);
            free(buf);
            sha_cleanup(alg, hash, hash_object);
            fclose(out);
            DeleteFileW(local);
            afc_file_close(afc, handle);
            close_afc(device, afc);
            return 9;
        }
        if (got == 0) break;
        if (fwrite(buf, 1, got, out) != got) {
            fprintf(stderr, "Local destination write failed.\n");
            free(buf);
            sha_cleanup(alg, hash, hash_object);
            fclose(out);
            DeleteFileW(local);
            afc_file_close(afc, handle);
            close_afc(device, afc);
            return 10;
        }
        if (BCryptHashData(hash, buf, got, 0) < 0) {
            fprintf(stderr, "SHA-256 update failed.\n");
            free(buf);
            sha_cleanup(alg, hash, hash_object);
            fclose(out);
            DeleteFileW(local);
            afc_file_close(afc, handle);
            close_afc(device, afc);
            return 11;
        }
        total += got;
    }

    fflush(out);
    fclose(out);
    free(buf);
    afc_file_close(afc, handle);
    close_afc(device, afc);

    unsigned char digest[32];
    if (BCryptFinishHash(hash, digest, sizeof(digest), 0) < 0) {
        fprintf(stderr, "SHA-256 finalization failed.\n");
        sha_cleanup(alg, hash, hash_object);
        DeleteFileW(local);
        return 12;
    }
    sha_cleanup(alg, hash, hash_object);

    fputs("{\"bytes\":", stdout);
    printf("%llu,\"sha256\":\"", (unsigned long long)total);
    for (int i = 0; i < 32; ++i) printf("%02x", digest[i]);
    fputs("\"}\n", stdout);
    return 0;
}

static void usage(void) {
    fprintf(stderr, "iMusicRecovery read-only AFC helper\n");
    fprintf(stderr, "Usage:\n");
    fprintf(stderr, "  afc-ro list <udid> <remote-directory>\n");
    fprintf(stderr, "  afc-ro pull <udid> <remote-file> <local-file>\n");
}

int wmain(int argc, wchar_t **argv) {
    if (argc < 2) { usage(); return 64; }

    if (wcscmp(argv[1], L"list") == 0 && argc == 4) {
        char *udid = wide_to_utf8(argv[2]);
        char *remote = wide_to_utf8(argv[3]);
        if (!udid || !remote) {
            free(udid); free(remote);
            fprintf(stderr, "Could not convert command arguments to UTF-8.\n");
            return 65;
        }
        int rc = cmd_list(udid, remote);
        free(udid); free(remote);
        return rc;
    }

    if (wcscmp(argv[1], L"pull") == 0 && argc == 5) {
        char *udid = wide_to_utf8(argv[2]);
        char *remote = wide_to_utf8(argv[3]);
        if (!udid || !remote) {
            free(udid); free(remote);
            fprintf(stderr, "Could not convert command arguments to UTF-8.\n");
            return 65;
        }
        int rc = cmd_pull(udid, remote, argv[4]);
        free(udid); free(remote);
        return rc;
    }

    usage();
    return 64;
}

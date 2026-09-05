export LD_LIBRARY_PATH=$PREFIX

mkdir -p "$PREFIX/tmp"
mkdir -p "$PREFIX/alpine/tmp"
mkdir -p "$PREFIX/public"

export PROOT_TMP_DIR=$PREFIX/tmp

if [ "$FDROID" = "true" ]; then

    if [ -f "$PREFIX/libproot.so" ]; then
        export PROOT_LOADER="$PREFIX/libproot.so"
    fi

    if [ -f "$PREFIX/libproot32.so" ]; then
        export PROOT_LOADER32="$PREFIX/libproot32.so"
    fi


    export PROOT="$PREFIX/libproot-xed.so"
    chmod +x $PREFIX/*
else
    if [ -f "$NATIVE_DIR/libproot.so" ]; then
        export PROOT_LOADER="$NATIVE_DIR/libproot.so"
    fi

    if [ -f "$NATIVE_DIR/libproot32.so" ]; then
        export PROOT_LOADER32="$NATIVE_DIR/libproot32.so"
    fi


    if [ -e "$PREFIX/libtalloc.so.2" ] || [ -L "$PREFIX/libtalloc.so.2" ]; then
        rm "$PREFIX/libtalloc.so.2"
    fi

    ln -s "$NATIVE_DIR/libtalloc.so" "$PREFIX/libtalloc.so.2"
    export PROOT="$NATIVE_DIR/libproot-xed.so"
fi

ARGS="--kill-on-exit"



for system_mnt in /apex /odm /product /system /system_ext /vendor /linkerconfig/ld.config.txt /linkerconfig/com.android.art/ld.config.txt /plat_property_contexts /property_contexts; do

 if [ -e "$system_mnt" ]; then
  system_mnt=$(realpath "$system_mnt")
  ARGS="$ARGS -b ${system_mnt}"
 fi
done




unset system_mnt

ARGS="$ARGS -b /sdcard"
ARGS="$ARGS -b /storage"
ARGS="$ARGS -b /dev"
ARGS="$ARGS -b /data"
ARGS="$ARGS -b /dev/urandom:/dev/random"
ARGS="$ARGS -b /proc"
ARGS="$ARGS -b /sys"
ARGS="$ARGS -b $PREFIX"
ARGS="$ARGS -b $NATIVE_DIR"
ARGS="$ARGS -b $PREFIX/public:/public"
ARGS="$ARGS -b $PREFIX/public:/home"
ARGS="$ARGS -b $PREFIX/public:/root"
ARGS="$ARGS -b $PREFIX/alpine/tmp:/dev/shm"


if [ -e "/proc/self/fd" ]; then
  ARGS="$ARGS -b /proc/self/fd:/dev/fd"
fi

# Bind stdin/stdout/stderr ONLY when they resolve to a real file/device.
# When the app launches the sandbox with pipes (installations, command
# output capture), /proc/self/fd/N points to a virtual "pipe:[…]" target
# that proot cannot sanitize — it printed three scary
#   proot warning: can't sanitize binding "/proc/self/fd/N"
# lines during installation while everything still worked. Skipping the
# binding in that case silences the warnings; the guest still reaches the
# fds through the bound /proc and /dev (fd 0/1/2 pass through natively).
for sandbox_fd in 0 1 2; do
  fd_target=$(readlink -f "/proc/self/fd/$sandbox_fd" 2>/dev/null || true)
  if [ -n "$fd_target" ] && [ -e "$fd_target" ]; then
    case "$sandbox_fd" in
      0) ARGS="$ARGS -b /proc/self/fd/0:/dev/stdin" ;;
      1) ARGS="$ARGS -b /proc/self/fd/1:/dev/stdout" ;;
      2) ARGS="$ARGS -b /proc/self/fd/2:/dev/stderr" ;;
    esac
  fi
done
unset sandbox_fd fd_target


ARGS="$ARGS -r $PREFIX/alpine"
ARGS="$ARGS -0"
ARGS="$ARGS --link2symlink"
ARGS="$ARGS --sysvipc"
ARGS="$ARGS -L"


FAILSAFE=false
INSTALLING=false

for arg in "$@"; do
    case "$arg" in
        --failsafe)
            FAILSAFE=true
            ;;
        --installing)
            INSTALLING=true
            ;;
    esac
done

if [ "$FAILSAFE" = true ] && [ "$INSTALLING" != true ]; then
    echo "$$" > "$PREFIX/pid"

    LINKER="/system/bin/linker64"
    ARCH="$(uname -m)"
    if [ "$ARCH" != "aarch64" ] && [ "$ARCH" != "x86_64" ]; then
        LINKER="/system/bin/linker"
    fi

    exec "$LINKER" "$PREFIX/axs" -c "sh"
else
    exec "$PROOT" $ARGS /bin/sh "$PREFIX/init-alpine.sh" "$@"
fi
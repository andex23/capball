# Counterball for Android (Google Play)

A Trusted Web Activity: a small Android app that opens https://www.counterball.fun full screen in Chrome, with no browser bar. The game itself is the website, so every web deploy updates the app too. Only rebuild the app to change its name, icon, splash or package settings.

Generated with Bubblewrap from the live web manifest. Package: `fun.counterball.app`.

## Build

Needs JDK 17+ and the Android SDK (platform 36, build-tools 35+).

```sh
cd android
echo "sdk.dir=/path/to/android-sdk" > local.properties
./gradlew bundleRelease assembleRelease
```

Outputs are unsigned:
- `app/build/outputs/bundle/release/app-release.aab`, for Play
- `app/build/outputs/apk/release/app-release-unsigned.apk`, for installing on a phone

Sign them with the upload key, which is never committed:

```sh
jarsigner -keystore upload.keystore -sigalg SHA256withRSA -digestalg SHA-256 app-release.aab upload
zipalign -f -p 4 app-release-unsigned.apk aligned.apk
apksigner sign --ks upload.keystore --ks-key-alias upload --out counterball.apk aligned.apk
```

For each new upload to Play, raise `versionCode` (and `versionName`) in `app/build.gradle` first.

## Full screen without the address bar

Android only hides Chrome's address bar when the site vouches for the app in `public/.well-known/assetlinks.json`. That file must list the SHA-256 fingerprint of every key the app is signed with:

1. **The upload key.** It's already listed, so builds you sign yourself (sideloaded APKs) open full screen.
2. **Google's app signing key.** Play re-signs the app with its own key. After the first upload, copy the SHA-256 from Play Console → Test and release → App integrity → App signing, add it to the `sha256_cert_fingerprints` list, and deploy the website.

If the address bar shows in the Play build, the second fingerprint is missing.

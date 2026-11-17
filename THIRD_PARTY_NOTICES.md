# Third-party notices

Burnigator bundles the following third-party libraries in `assets/vendor/` so that it runs without a build step or a package manager. Each library keeps its own license, and the full license text ships next to the library.

| Library | Version | License | License file |
| --- | --- | --- | --- |
| [Leaflet](https://leafletjs.com/) | 1.9.4 | BSD 2-Clause | [`assets/vendor/leaflet/LICENSE`](assets/vendor/leaflet/LICENSE) |
| [Font Awesome Free](https://fontawesome.com/) | 7.3.1 | Icons: CC BY 4.0, fonts: SIL OFL 1.1, code: MIT | [`assets/vendor/fontawesome/LICENSE.txt`](assets/vendor/fontawesome/LICENSE.txt) |
| [QRCode.js](https://github.com/davidshimjs/qrcodejs) | n/a | MIT | [`assets/vendor/qrcode-LICENSE.txt`](assets/vendor/qrcode-LICENSE.txt) |

## External services

These are not bundled. They are loaded from their providers only when the owner enables them, and each has its own terms:

- **SoundCloud** player, when a playlist URL is configured.
- **Matomo**, when a Matomo URL and site ID are configured.

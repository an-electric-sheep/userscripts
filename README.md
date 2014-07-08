

## pixiv infinite scroll

Use the [greasyfork mirror](https://greasyfork.org/scripts/3091-pixiv-infinite-scroll-download-links) for auto-updates.

Most likely won't work on anything but firefox/greasemonkey since it makes use of some bleeding-edge javascript features and some styles are only written with `-moz-` vendor prefixes (I'm lazy).

### Features

* Automatically expands thumbnails in the search and artist's work pages to the full size image (mode=big, not just mode=medium)
* Inlines manga mode overview (in medium mode) and expands them on a 2nd click to big mode
* Explodes animation frames to a horizontal scroll and offers a download link
* Modifies the .zip file in the download link on the fly to add timecode information for each frame


The zip with timecodes can be used by the pixiv2webm and pixiv2gif ruby scripts you can find in the `/bin` directory.

## pixiv2webm

Requirements:

* ruby >= 1.9
* ffmpeg
* mkvtools  


## pixiv2gif

Requirements:

* ruby >= 1.9
* imagemagick  



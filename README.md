

## pixiv infinite scroll

Use the [greasyfork mirror](https://greasyfork.org/scripts/3091-pixiv-infinite-scroll-download-links) for auto-updates.

Most likely won't work on anything but firefox/greasemonkey since it makes use of some bleeding-edge javascript features and some styles are only written with `-moz-` vendor prefixes (I'm lazy).

Tested with Greasemonkey 2.0 on Firefox 30 and 33

### Features

* Infinite scroll for search and artists' work pages
* Expands single-image thumbnails on click in the search and artist's work pages to the full size image (mode=big, not just mode=medium)
* First click on manga mode thumbnail inlines the mode=medium images of all manga pages, a 2nd click on the individual pages loads mode=big
* Explodes animation frames to a horizontal scroll and offers a download link on the search/works pages
* Modifies the .zip file in the download link on the fly to add timecode information for each frame


The zip with timecodes can be used by the pixiv2webm and pixiv2gif ruby scripts you can find in the `/bin` directory.

## pixiv2webm

Requirements:

* ruby >= 1.9
* unzip
* ffmpeg
* mkvtools

Usage: `pixiv2webm.rb <filename>.zip`

## pixiv2gif

Requirements:

* ruby >= 1.9
* unzip
* imagemagick  


Usage: `pixiv2gif.rb <filename>.zip`
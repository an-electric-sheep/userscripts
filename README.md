

## pixiv infinite scroll

Use the [greasyfork mirror](https://greasyfork.org/scripts/3091-pixiv-infinite-scroll-download-links) for auto-updates.

Most likely won't work on anything but firefox/greasemonkey since it makes use of some bleeding-edge javascript features and some styles are only written with `-moz-` vendor prefixes (I'm lazy).

Tested with Greasemonkey 2.0 on Firefox 30 and 33

### Features

#### infinite scroll with flexible-width layout

Search, new works (everyone, new works (followed artists), artist works pages are all auto-paginated. Additionally a custom stylesheet for flexible-width layout is injected 

980px:

<a href="screenshots/flexible_layout_980x.png"><img src="screenshots/flexible_layout_980x.png" alt="search page at 980px viewport width"></a>

2560px:

<a href="screenshots/flexible_layout_2560x.png"><img src="screenshots/flexible_layout_2560x.png" alt="search page at 2560px viewport width"></a>

#### inline expansion

for simple images

<a href="screenshots/illustration_inline_expansion.png"><img src="screenshots/illustration_inline_expansion.png" alt="image inline expansion"></a> 

loading thumbnails for individual pages of a manga gallery

<a href="screenshots/manga_inline_expansion1.png"><img src="screenshots/manga_inline_expansion1.png" alt="manga thumbnails"></a>

expanding individual pages of a manga 

<a href="screenshots/manga_inline_expansion2.png"><img src="screenshots/manga_inline_expansion2.png" alt="manga inline expansion"></a>

animated illustrations (ugoira) loads the full resolution animation, individual frames frames and the option to download a .zip file that includes the timecode necessary to properly encode the animations to other formats

<a href="screenshots/animation_inline_expansion.png"><img src="screenshots/animation_inline_expansion.png" alt="animation inline expansion"></a>


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
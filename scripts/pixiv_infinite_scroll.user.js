// ==UserScript==
// @name        Pixiv Infinite Scroll/Download Links
// @description Adds infinite scroll and inline expansion on the search page and artists' works pages. For manga mode a two-step expansion is used.
// @namespace   https://github.com/an-electric-sheep/userscripts
// @match       *://www.pixiv.net/search*
// @match       *://www.pixiv.net/member_illust*
// @match       *://www.pixiv.net/new_illust*
// @match       *://www.pixiv.net/bookmark_new_illust*
// @require     https://cdnjs.cloudflare.com/ajax/libs/jszip/2.4.0/jszip.js
// @downloadURL https://github.com/an-electric-sheep/userscripts/raw/master/scripts/pixiv_infinite_scroll.user.js
// @version     0.6.0
// @grant       GM_xmlhttpRequest
// @run-at      document-start
// ==/UserScript==

"use strict";

function Maybe(wrapped) {
  if (typeof this !== "object" || Object.getPrototypeOf(this) !== Maybe.prototype) {
    var o = Object.create(Maybe.prototype);
    o.constructor.apply(o, arguments);
    return o;
  }
  
  this.wrapped = wrapped;
}

Maybe.prototype.isEmpty = function(){return null == this.wrapped}
Maybe.prototype.orElse = function(other){return this.isEmpty() ? Maybe(other) : this}
Maybe.prototype.apply = function(f){if(!this.isEmpty()){f.apply(null, [this.wrapped].concat(Array.prototype.slice.call(arguments, 1)))};return this;}
Maybe.prototype.map = function(f){return this.isEmpty() ? this :  Maybe(f.apply(null, [this.wrapped].concat(Array.prototype.slice.call(arguments,1))));}
Maybe.prototype.get = function(){return this.wrapped;}

// incomplete shim for older FF versions
if(!Array.hasOwnProperty("from")) {
  Object.defineProperty(Array, "from",  {
    enumerable: false,
    configurable: true,
    value: function(e) {
        return Array.prototype.slice.call(e)
    }
  });
}

if(!Array.prototype.hasOwnProperty("last")) {
  Object.defineProperty(Array.prototype, 'last', {
    enumerable: false,
    configurable: true,
    get: function() {
        return this.length > 0 ? this[this.length - 1] : undefined;
    },
    set: undefined
  });
}

Object.defineProperty(Function.prototype, "passThis", {value: function(){let f= this; return function(){f.apply(null, [this].concat(arguments))}}})

var styleAdded = false


function xpathAt(path, element){
  var result = document.evaluate(path, element || document.documentElement, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
  return result.singleNodeValue
}

const imgContainerSelector = "._image-items, .image-items, .display_works > ul";

document.addEventListener("DOMContentLoaded", function() {
  for(var e of document.querySelectorAll("iframe, .ad-printservice, .popular-introduction")){e.remove()}
  
  window.addEventListener("scroll", NextPageHandler.checkAll)
  window.addEventListener("resize", NextPageHandler.checkAll)
  window.requestAnimationFrame(AnimatedCanvas.updateAll)
  
  for(var e of document.querySelectorAll(".image-item")){customizeImageItem(e)}
  
  
  Maybe(Array.from(document.querySelectorAll(".pager-container")).last).apply(paginator => {
    Maybe(document.querySelector(".image-item:last-child")).apply(lastItem => {
      var trigger = new NextPageHandler(lastItem)
      trigger.paginator = paginator
      trigger.url = paginator.querySelector("a[rel=next]").href
    })
  })
  
  NextPageHandler.checkAll();
  
  mediumPageHandler();
})

function insertStyle() {
  if(styleAdded)
    return;

  // wait until the parser is done with <head>
  if(!(document.querySelector("body"))) {
    window.requestAnimationFrame(insertStyle);
    return;
  }

  Maybe(document.querySelector("head")).map(head => head.appendChild(document.createElement("style")).sheet).apply(sheet => {

    Array(
      // global
      "#wrapper {width: unset;}",
      // search page
      ".layout-body {width: 85vw;}",
      // member page
      ".layout-a {width: unset;}",
      ".layout-a .layout-column-2 {width: calc(100vw - 190px);}",
      // member works list
      ".display_works {width: unset;}",
      ".display_works .image-item {float: none; }",
      // member illust page
      ".works_display {width: unset;}",
      ".works_display img, .works_display ._layout-thumbnail {max-width: -moz-available; max-width: available}",
      // search and member works list
      "._image-items, .image-items, .display_works > ul {display: flex;flex-wrap: wrap;}",
      ".image-item img {padding: 0px; border: none;}",
      ".inline-expandable {cursor: pointer;}",
      ".image-item.expanded {width: 100%; height: unset;}",
      ".image-item.expanded .image-item-main {max-width: 80%; }",
      ".inline-expandable img {max-width: 100%; }",
      ".image-item.expanded .inline-expandable, .image-item.expanded img.manga {max-width: -moz-available; max-width: available;}",
      ".manga-item {background-color: #f3f3f3 !important;}",
      ".image-item img.manga-medium {max-width: 156px; max-height: 230px; cursor: pointer;}",
      // animated content inlined in the search page
      ".exploded-animation-scroller {overflow-x: auto; width: 100%; margin: 5px 0px; box-shadow: 0px 0px 4px 1px #444;}",
      ".exploded-animation {display: flex; width: -moz-fit-content; width: fit-content; }",
      ".exploded-animation img {margin-left: 5px;}",
      ".has-extended-info {display: flex; flex-wrap: wrap; justify-content: center; min-width: 342px; width: unset; height: unset;}",
      ".extended-info {margin-left: 0.8em;}",
      ".extended-info > * {margin-bottom: 1em; text-align: left; }",
      ".extended-info .tags .tag {float: unset; text-align: left; height: unset; width: unset; border: unset; padding: unset; background: unset; display: list-item; margin: 0px;}",
      "._layout-thumbnail:after {pointer-events: none;}"

    ).reverse().forEach(r => sheet.insertRule(r,0))

    styleAdded = true
  });
}

// attempt to insert immediately
insertStyle()





function mediumPageHandler() {
  var modeLink = document.querySelector('.works_display a[href*="mode"]')
  if(!modeLink)
   return;

  var modeLinkUrl = modeLink.href
  var mode = modeLinkUrl.match(/mode=(.+?)&/)[1]

  var mediumSrc = modeLink.querySelector("img").src
  var container = modeLink.parentNode;
  
  modeLink.addEventListener("click",(e) => {
    e.preventDefault();

    if(greasedImageItems.has(modeLink))
      return;
    
    greasedImageItems.set(modeLink, true)
    
    if(mode == "big") {
      insertBigItem(container, mediumSrc, modeLink, window.location.href)
    }
    
    if(mode == "manga"){
      insertMangaItems(container, modeLinkUrl)
    }
    
    
  })

}


function NextPageHandler(e) {
  if(!e)
    throw "element required";

  this.element = e;
  NextPageHandler.paginationTriggers.add(this)
}

NextPageHandler.paginationTriggers = new Set()

NextPageHandler.checkAll = function() {
  NextPageHandler.paginationTriggers.forEach(e => e.tryLoad())
}


NextPageHandler.prototype.tryLoad = function(){
  if(this.loading || !this.url || !inViewport(this.element))
    return;
  this.loading = true
  
  var req = new XMLHttpRequest();
  req.open("get", this.url)
  req.onabort = () => this.loading = false
  req.onerror = () => this.loading = false
  req.onload = () => {
    var rsp = req.responseXML;
    var nextItem = this.element.nextSibling;
    var container = this.element.parentNode;
    
    var newPaginator = rsp.querySelector(".pager-container")
    var newItems = Array.from(rsp.querySelectorAll(".image-item"))
    
    var lastItem = newItems.map(e => {
      var imageItem = document.importNode(e, true)
      container.insertBefore(imageItem, nextItem)
      customizeImageItem(imageItem)
      return imageItem
    }).last
    
    if(lastItem)    
      Maybe(newPaginator.querySelector("a[rel=next]")).map(e => e.href).apply(url => {
        var nextHandler = new NextPageHandler(lastItem)
        nextHandler.url = url
        nextHandler.paginator = this.paginator
      })
    
    if(this.paginator) {
      while(this.paginator.hasChildNodes())
        this.paginator.firstChild.remove()
      Array.from(newPaginator.childNodes).forEach(e => this.paginator.appendChild(document.importNode(e, true)))
    }
    this.destroy()
    this.loading = false
    NextPageHandler.checkAll();
  }
  req.responseType = "document"
  req.send()
}


NextPageHandler.prototype.destroy = function(){NextPageHandler.paginationTriggers.delete(this)}



function inViewport (el) {

    var rect = el.getBoundingClientRect();

    return (
        rect.bottom >= 0 &&
        rect.right >= 0 &&
        rect.top <= (window.innerHeight || document.documentElement.clientHeight) && 
        rect.left <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

function MangaItem(container, insertBefore, mediumPageElement) {
  let mediumImg = mediumPageElement.querySelector(".image")
  this.bigUrl = mediumPageElement.querySelector(".full-size-container").href
    
  let item = this.item = document.createElement("li")
  item.className = "image-item manga-item"
  let img = this.img = document.createElement("img")
  img.src = mediumImg.dataset.src
  img.className = "manga-medium"
  img.addEventListener("click", () => this.expand())
  item.appendChild(img)
  
  container.insertBefore(item, insertBefore)
}

MangaItem.prototype = {
  expand: function() {
    let mediumSrc = this.img.src

    let newImg = document.createElement("img")
    newImg.className = "manga"

    // old image format
    // test with http://www.pixiv.net/member_illust.php?mode=medium&illust_id=43499240
    mediumSrc = mediumSrc.replace(/_p(\d+)\./, "_big_p$1.")
    // new image format
    // test with http://www.pixiv.net/member_illust.php?mode=medium&illust_id=46288162
    mediumSrc = mediumSrc.replace(/\/c\/1200x1200\/img-master\//, "/img-original/");
    mediumSrc = mediumSrc.replace(/_master1200\./, ".");

    let extensions = [".png", ".gif"]

    newImg.addEventListener("load", () => this.insertExpanded(newImg))
    newImg.addEventListener("error", () => {
      if(extensions.length > 0) {
        let ext = extensions.shift()
        newImg.src = mediumSrc.replace(/\.jpg$/, ext)
      } else {
        // TODO: load big page and get proper url from there
      }
    })
    newImg.src = mediumSrc;

  },
  insertExpanded: function(expandedImg) {
    this.img.parentNode.replaceChild(expandedImg,this.img)
    this.item.classList.add("expanded")
  }
}


function insertMangaItems(parentItem,url) {   
  var req = new XMLHttpRequest
  req.open("get", url)
  req.onload = function() {
    var rsp = this.responseXML
    
    var nextItem = parentItem.nextSibling
    var container = parentItem.parentNode
    
    for(var e of rsp.querySelectorAll(".item-container")) {
      new MangaItem(container, nextItem, e)
    }
  }
  req.responseType = "document"
  req.send()
  
}

function AnimatedCanvas(container, frames) {
  this.container = container
  this.frames = frames
  this.currentFrame = 0
  
  this.canvas = document.createElement("canvas")
  this.canvas.setAttribute("width", frames[0].img.naturalWidth)
  this.canvas.setAttribute("height", frames[0].img.naturalHeight)
  
  var img = container.querySelector(".inline-expandable img")
  img.parentNode.replaceChild(this.canvas, img)
  
  this.ctx = this.canvas.getContext("2d")
  
  this.ctx.drawImage(frames[0].img, 0, 0)
  this.timestamp = null
  
  AnimatedCanvas.instances.add(this)
}

AnimatedCanvas.prototype.update = function(timestamp) {
  if(!inViewport(this.canvas))
    return;

  if(!this.timestamp){
    this.timestamp = timestamp
    return;
  }
  
  if(timestamp - this.timestamp > this.frames[this.currentFrame].delay)
  {
    this.timestamp = timestamp
    this.currentFrame = (this.currentFrame + 1) % this.frames.length;
    this.ctx.drawImage(this.frames[this.currentFrame].img, 0, 0)
  }
}

AnimatedCanvas.instances = new Set();
AnimatedCanvas.updateAll = function(timestamp) {
  AnimatedCanvas.instances.forEach(i => i.update(timestamp))
  window.requestAnimationFrame(AnimatedCanvas.updateAll)
}


function insertAnimationItems(container, mediumDoc) {
  var script = mediumDoc.querySelector("#wrapper script")

  console.log(script.firstChild.data)


  // it's not a strong sandbox. it just avoids the loaded script writing to the main window
  var sandbox = document.createElement("iframe")
  //sandbox.src = window.location.href
  sandbox.seamless = true
  sandbox.setAttribute("srcdoc", "<!DOCTYPE html><html><head><script>window.pixiv = {context: {}}</script><script>"+ script.firstChild.data +"</script></head></html>")
  sandbox.onload = () => {
    let sandboxWindow = sandbox.contentWindow

    // access unsafe window to read data structure created by the script
    if(sandboxWindow.wrappedJSObject)
      sandboxWindow = sandboxWindow.wrappedJSObject

    // sanitize via json encode/decode
    var pixivContext = JSON.parse(JSON.stringify(sandboxWindow.pixiv.context))

    let illustData = pixivContext.ugokuIllustFullscreenData
     
    var req = new XMLHttpRequest
    req.open("get", illustData.src)
    req.responseType = "arraybuffer"
    req.onload = function () {
    
      var buffer = this.response
      var zip = new JSZip(buffer)

      var downloadLink = document.createElement("a")
      downloadLink.innerHTML = downloadLink.download = pixivContext.illustId + ".zip"
      downloadLink.className = "animation-download";

      var downloadInfo = document.createElement("div");
      downloadInfo.className = "animated-item-download";
      
      [
        document.createTextNode("Download: "),
        downloadLink,
        document.createElement("br"),
        document.createTextNode("pixiv2webm and pixiv2gif available "),
        Maybe(document.createElement("a")).apply(e => {e.href = "https://github.com/an-electric-sheep/userscripts"; e.innerHTML = "on github"}).get()
      ].forEach(e => downloadInfo.appendChild(e))
      
      container.querySelector(".extended-info").appendChild(downloadInfo)
      
      var scrollContainer = document.createElement("div")
      var explodedAnimation = document.createElement("div")
      scrollContainer.className = "exploded-animation-scroller"
      explodedAnimation.className = "exploded-animation"
      
      scrollContainer.appendChild(explodedAnimation)
      container.appendChild(scrollContainer)
      
      var timingInformation = []
      
      var frames = []

      for(var name in zip.files){
        let file = zip.file(name)
        let imgBuf = file.asArrayBuffer()
        let imgBlob = new Blob([imgBuf])
        
        let img = document.createElement("img")
        let delay = illustData.frames.find((e) => e.file == name).delay
        
        img.src = URL.createObjectURL(imgBlob)
        
        frames.push({"img": img, "delay": delay})
        timingInformation.push(file.name  + "\t" + delay)
        explodedAnimation.appendChild(img)
      }
      container.classList.add("expanded")
      
      frames[0].img.onload = () => new AnimatedCanvas(container, frames)
      
      zip.file("frame_delays.txt", timingInformation.join("\n"))
      
      downloadLink.href = URL.createObjectURL(zip.generate({type: "blob"}))
      
      sandbox.remove();
    }
    req.send()
  }
  document.body.appendChild(sandbox)

}

function insertItemTags(container, responseDoc) {
  var tags = document.importNode(responseDoc.querySelector(".tags"), true)
  container.querySelector(".extended-info").appendChild(tags)
  container.classList.add("has-extended-info")
}

function insertBigItem(container, mediumSrc, bigLinkUrl, mediumLinkUrl) {
  let newImg = document.createElement("img")
  let curImg = container.querySelector("img")
  newImg.setAttribute("class", curImg.getAttribute("class"))
  
  if(mediumSrc.match(/_m\./)) {
    // old format, just derive big url from medium url
    newImg.src = mediumSrc.replace("_m.", ".");
    
  
  } else {
    // new/complex format, e.g.  http://www.pixiv.net/member_illust.php?mode=medium&illust_id=46204420
    // requires a full "mode=big" request to determine the correct img uri

    GM_xmlhttpRequest({
      method: "GET",
      url: bigLinkUrl,
      headers: {
        // we are only allowed to load the mode=big page when referer is mode=medium
        "Referer": mediumLinkUrl
      },
      onerror: function() {
        console.log("big mode load error")
      },
      onload: function(response) {
        console.log("complex load")
        let rsp = response.responseXML;
        // Inject responseXML into existing Object (only appropriate for XML content).
        if (!response.responseXML) {
          rsp = new DOMParser().parseFromString(response.responseText, "text/html");
        }
        newImg.src = rsp.querySelector("img").src
      }
    });

  }
  
  newImg.addEventListener("load", () => {curImg.parentNode.replaceChild(newImg, curImg);container.classList.add("expanded")})
  newImg.addEventListener("error", () => {
    container.appendChild(document.createTextNode("Failed to load full size image. If this problem persists please report a bug for the infinite scroll userscript"))
  })


  
}


const greasedImageItems = new WeakMap();

function customizeImageItem(itemElement) {
  if(greasedImageItems.has(itemElement))
   return;

  let wrapper = new ImageItem(itemElement)

  greasedImageItems.set(itemElement, wrapper);
}

function ImageItem(item) {
  let workLink = this.workLink = item.querySelector("a.work")

  this.container = item



  let img = this.img = item.querySelector("img")
  let mainInfoContainer = document.createElement("div")
  let imgContainer = document.createElement("div")
  let expandedInfo = document.createElement("aside") 


  mainInfoContainer.appendChild(imgContainer)
  imgContainer.appendChild(img)
  while(item.hasChildNodes())
    mainInfoContainer.appendChild(item.firstChild)

  item.appendChild(mainInfoContainer)
  item.appendChild(expandedInfo)

  mainInfoContainer.className = "image-item-main"

  imgContainer.classList.add("inline-expandable")
  // copy a few classes over so the user knows what kind of item it is
  Array("_work", "multiple", "manga", "ugoku-illust").forEach(cl => {
    if(workLink.classList.contains(cl))
      imgContainer.classList.add(cl)
  })

  img.className = ""

  img.addEventListener("click", () => this.listItemExpand())

  // remove from dom due to after/before styles
  workLink.remove()

  expandedInfo.className = "extended-info"
}

ImageItem.prototype = {
  listItemExpand: function() {
    if(this.expanded)
      return;
    this.expanded = true

    let container = this.container;
    while(!container.classList.contains("image-item"))
      container = container.parentNode;
    let mediumLink = this.workLink.href
    let req = new XMLHttpRequest()
    req.open("get", mediumLink)
    req.onerror = () => {this.expanded = false}
    req.onload = function() {
      let rsp = this.responseXML;
      
      insertItemTags(container, rsp)
      
      if(rsp.querySelector("._ugoku-illust-player-container")) {
        insertAnimationItems(container, rsp)
      }
      
      Maybe(rsp.querySelector('.works_display a[href*="mode"]')).apply((modeLink) => {
        let modeLinkUrl = modeLink.href
        let mediumSrc = modeLink.querySelector("img").src
        
        let mode = modeLinkUrl.match(/mode=(.+?)&/)[1]
        if(mode == "big") {
          insertBigItem(container, mediumSrc, modeLinkUrl, mediumLink)
        }
        
        if(mode == "manga"){
          insertMangaItems(container, modeLinkUrl)
        }
      })

      Maybe(rsp.querySelector(".works_display .big, .original-image")).apply(big => {
        let newImg = document.createElement("img")
        newImg.addEventListener("load", () => {
          container.classList.add("expanded")
          let oldImg = container.querySelector("img")
          oldImg.parentNode.replaceChild(newImg, oldImg)

        })
        newImg.src = big.dataset.src
        
      })
     
    }
    req.responseType = "document"
    req.send()
    
  }
}
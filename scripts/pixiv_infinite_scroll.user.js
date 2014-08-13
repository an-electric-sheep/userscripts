// ==UserScript==
// @name        Pixiv Infinite Scroll/Download Links
// @description Adds infinite scroll and inline expansion on the search page and artists' works pages. For manga mode a two-step expansion is used.
// @namespace   https://github.com/an-electric-sheep/userscripts
// @match       *://www.pixiv.net/search*
// @match       *://www.pixiv.net/member_illust*
// @match       *://www.pixiv.net/new_illust*
// @match       *://www.pixiv.net/bookmark_new_illust*
// @downloadURL https://github.com/an-electric-sheep/userscripts/raw/master/scripts/pixiv_infinite_scroll.user.js
// @version     0.5.1
// @grant       none
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
if(!Array.hasOwnProperty("from"))
  Object.defineProperty(Array, "from",  {
    enumerable: false,
    configurable: true,
    value: function(e) {
        return Array.prototype.slice.call(e)
    }
  });

if(!Array.prototype.hasOwnProperty("last"))
  Object.defineProperty(Array.prototype, 'last', {
    enumerable: false,
    configurable: true,
    get: function() {
        return this.length > 0 ? this[this.length - 1] : undefined;
    },
    set: undefined
  });

Object.defineProperty(Function.prototype, "passThis", {value: function(){var f = this; return function(){f.apply(null, [this].concat(arguments))}}})


function xpathAt(path, element){
  var result = document.evaluate(path, element || document.documentElement, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
  return result.singleNodeValue
}

const imgContainerSelector = "._image-items, .image-items, .display_works > ul";

document.addEventListener("DOMContentLoaded", function() {
  for(var e of document.querySelectorAll("iframe, .ad-printservice, .popular-introduction")){e.remove()}
  var sheet = document.querySelector("head").appendChild(document.createElement("style")).sheet;
  
  [
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
    // search and member works list
    "._image-items, .image-items, .display_works > ul {display: flex;flex-wrap: wrap;}",
    ".image-item img {padding: 0px; border: none;}",
    ".inline-expandable {cursor: pointer;}",
    ".image-item.expanded {width: 100%; height: unset;}",
    ".image-item.expanded .image-item-main {max-width: 80%; }",
    ".image-item.expanded img.inline-expandable, .image-item.expanded img.manga {max-width: -moz-available; max-width: available;}",
    ".manga-item {background-color: #f3f3f3 !important;}",
    ".image-item img.manga-medium {max-width: 156px; max-height: 230px; cursor: pointer;}",
    // animated content inlined in the search page
    ".exploded-animation-scroller {overflow-x: auto; width: 100%; margin: 5px 0px; box-shadow: 0px 0px 4px 1px #444;}",
    ".exploded-animation {display: flex; width: -moz-fit-content; width: fit-content; }",
    ".exploded-animation img {margin-left: 5px;}",
    ".has-extended-info {display: flex; flex-wrap: wrap; justify-content: center; min-width: 342px; width: unset; height: unset;}",
    ".extended-info {margin-left: 0.8em;}",
    ".extended-info > * {margin-bottom: 1em; text-align: left; }",
    ".extended-info .tags .tag {float: unset; text-align: left; height: unset; width: unset; border: unset; padding: unset; background: unset; display: list-item; margin: 0px;}"
  ].reverse().forEach(r => sheet.insertRule(r,0))
  
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
      var img = container.querySelector("img")
      img.src = mediumSrc.replace("_m.", ".");
      container.classList.add("expanded")
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

function mangaItemExpand() {
  this.removeEventListener("click", mangaItemExpand)
  
  var container = this;
  while(!container.classList.contains("image-item"))
    container = container.parentNode;
  
  var newImg = document.createElement("img");
  // just try to load the big image, this may fail for some older images, just expand in that case
  newImg.src = this.src.replace(/(_p\d+)/, "_big$1")
  newImg.addEventListener("load", () => {this.parentNode.replaceChild(newImg, this);container.classList.add("expanded")})
  newImg.addEventListener("error", () => container.classList.add("expanded"))
  newImg.className = "manga"
}


function insertMangaItems(parentItem,url) {   
  var req = new XMLHttpRequest
  req.open("get", url)
  req.onload = function() {
    var rsp = this.responseXML
    
    var nextItem = parentItem.nextSibling
    
    for(var e of rsp.querySelectorAll(".item-container")) {
      let mediumImg = e.querySelector(".image")
      let bigUrl = e.querySelector(".full-size-container").href
        
      let item = document.createElement("li")
      item.className = "image-item manga-item"
      let img = document.createElement("img")
      img.src = mediumImg.dataset.src
      img.className = "manga-medium"
      img.addEventListener("click", mangaItemExpand)
      item.appendChild(img)
      
      parentItem.parentNode.insertBefore(item, nextItem)
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
  
  var img = container.querySelector("img.inline-expandable")
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
  // it's not a strong sandbox. it just avoids the loaded script writing to the main window
  var sandbox = document.createElement("iframe")
  sandbox.src = window.location.href
  sandbox.seamless = true
  sandbox.setAttribute("srcdoc", "<!DOCTYPE html><html><head><script async src='https://cdn.jsdelivr.net/jszip/2.2.2/jszip.min.js'></script><script>window.pixiv = {context: {}}</script><script>"+ script.firstChild.data +"</script></head></html>")
  sandbox.onload = () => {
    var sandboxWindow = sandbox.contentWindow
    var illustData = sandboxWindow.pixiv.context.ugokuIllustFullscreenData
    var req = new sandboxWindow.XMLHttpRequest
    req.open("get", illustData.src)
    req.responseType = "arraybuffer"
    req.onload = function () {
    
      var buffer = this.response
      var zip = new sandboxWindow.JSZip(buffer)
      
      var downloadLink = document.createElement("a")
      downloadLink.innerHTML = downloadLink.download = sandboxWindow.pixiv.context.illustId + ".zip"
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


function listItemExpand() {

  var container = this;
  while(!container.classList.contains("image-item"))
    container = container.parentNode;
  var mediumLink = container.querySelector("a.work").href
  var req = new XMLHttpRequest
  req.open("get", mediumLink)
  req.onload = function() {
    var rsp = this.responseXML;
    
    insertItemTags(container, rsp)
    
    if(rsp.querySelector("._ugoku-illust-player-container")) {
      insertAnimationItems(container, rsp)
    }
    
    Maybe(rsp.querySelector('.works_display a[href*="mode"]')).apply((modeLink) => {
      var modeLinkUrl = modeLink.href
      var mediumSrc = modeLink.querySelector("img").src
      
      var mode = modeLinkUrl.match(/mode=(.+?)&/)[1]
      if(mode == "big") {
        var img = container.querySelector("img")
        img.src = mediumSrc.replace("_m.", ".");
        container.classList.add("expanded")
      }
      
      if(mode == "manga"){
        insertMangaItems(container, modeLinkUrl)
      }
    })
    
    
  }
  req.responseType = "document"
  req.send()
  this.removeEventListener("click", listItemExpand)
}

const greasedImageItems = new WeakMap;

function customizeImageItem(e) {
  if(greasedImageItems.has(e))
   return;
  greasedImageItems.set(e, true);
  var workLink = e.querySelector("a.work")
  
  var imageContainer = document.createElement("div")
  imageContainer.className = "image-item-main"
  var img = e.querySelector("img")
  img.classList.add("inline-expandable")
  img.addEventListener("click", listItemExpand)

  imageContainer.appendChild(img)
  while(e.hasChildNodes())
    imageContainer.appendChild(e.firstChild)
  e.appendChild(imageContainer)
  
  var expandedInfo = document.createElement("aside") 
  expandedInfo.className = "extended-info"
  
  e.appendChild(expandedInfo)
}

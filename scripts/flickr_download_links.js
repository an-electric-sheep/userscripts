// ==UserScript==
// @name        FlickrDownloadLinks
// @description Adds download links for all available image sizes to the flickr photstream hover boxes and removes elements that prevent rightclick->save as functionality.
// @namespace   https://github.com/an-electric-sheep/userscripts
// @include     https://www.flickr.com/photos/*
// @version     1
// @grant       none
// ==/UserScript==

"use strict";

if (! NodeList.prototype.forEach) {
  Object.defineProperty(NodeList.prototype, "forEach", {value: Array.prototype.forEach})
}

var customStyle = document.createElement("style")
customStyle.appendChild(document.createTextNode('\
  .greased-download-links {\
    clear: both;padding: 5px;\
    margin-bottom: 1.5em;\
    white-space:normal;\
    max-width: -moz-min-content;\
    min-width: -moz-fit-content;\
    line-height: 120%;\
    color: white;\
  }\
\
  .greased-download-links a {\
    margin: 2px; white-space:nowrap;text-decoration: underline;\
  }\
\
  /* remove overlays that prevent image saving */ \
  div.spaceball, .facade-of-protection-neue {display: none !important;}\
  .navigate-target {width: 100px !important;}\
'));

document.querySelector("head").appendChild(customStyle);


var alreadyProcessed = new Set();

var fetchImageUrl = function(anchor,pageUrl){
  var req = new XMLHttpRequest();
  req.open("get", pageUrl)
  req.onload = function(){
    var rsp = this.responseXML;
    var img = rsp.documentElement.querySelector("#allsizes-photo img")
    anchor.href = img.src
  }
  req.responseType = "document";
  req.send()
}

var generateImageLinks = function() {
  var e = this;

  if(alreadyProcessed.has(e))
    return;
  alreadyProcessed.add(e)

  var photoUrl = e.querySelector(".meta a.title").href;

  var linkContainer = document.createElement("div")
  linkContainer.className = "greased-download-links"
  e.querySelector(".meta").appendChild(linkContainer)

  var req = new XMLHttpRequest();
  // get all-sizes page
  req.open("get", photoUrl+"sizes/sq")
  req.onload = function(){
    var rspDoc = this.responseXML;

    for(var pageLink of rspDoc.querySelectorAll(".sizes-list a")){
      linkContainer.appendChild(document.createTextNode(" "))
      var newLink = linkContainer.appendChild(document.createElement("a"))

      newLink.appendChild(document.createTextNode(pageLink.firstChild.data))
      fetchImageUrl(newLink, pageLink.href)
    }
  }

  req.responseType = "document";
  req.send()
}

var enhancePhotoStream = function(rootNode) {
  for(var e of rootNode.querySelectorAll(".photo-display-item .hover-target")){
    e.querySelector("div.play").remove();
    e.addEventListener("mouseenter", generateImageLinks)
  }
}

// apply on page load
enhancePhotoStream(document);

// apply on ajax modifications
var observer = new MutationObserver(function(mutations) {
  mutations.forEach((mutation) => {
    for(var added of mutation.addedNodes){
      if(added instanceof HTMLElement)
        enhancePhotoStream(added)
    }
  });
});

var photoList = document.querySelector("#photo-list-holder")

if(photoList)
  observer.observe(photoList, { childList: true, subtree: true });
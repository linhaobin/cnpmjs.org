'use strict';

/**
 * Module dependencies.
 */

var debug = require('debug')('cnpmjs.org:middleware:proxy_to_npm');
var config = require('../config');

module.exports = function (options) {
  var redirectUrl = config.sourceNpmRegistry;
  var isWeb = options && options.isWeb
  var proxyUrls = createUrls(isWeb)
  var privatePackageUrls = createPrivatePackageUrls(isWeb)

  if (isWeb) {
    redirectUrl = redirectUrl.replace('//registry.', '//');
  }
  return function* proxyToNpm(next) {
    if (config.syncModel !== 'none') {
      return yield next;
    }
    // only proxy read requests
    if (this.method !== 'GET' && this.method !== 'HEAD') {
      return yield next;
    }

    var pathname = this.path;
    var match;
    for (var i = 0; i < proxyUrls.length; i++) {
      match = proxyUrls[i].test(pathname);
      if (match) {
        break;
      }
    }
    if (!match) {
      return yield next;
    }

    var isPrivatePackages
    for (var i = 0; i < privatePackageUrls.length; i++) {
      isPrivatePackages = privatePackageUrls[i].test(pathname);
      if (isPrivatePackages) {
        break;
      }
    }

    if (isPrivatePackages) {
      return yield next;
    }


    var url = redirectUrl + this.url;
    debug('proxy to %s', url);
    this.redirect(url);
  };
};

function createPrivatePackageUrls(isWeb) {
  var urls = []

  if (config.privatePackages && config.privatePackages.length) {
    for (var i = 0; i < config.privatePackages.length; i++) {
      urls = urls.concat(createUrls(isWeb, config.privatePackages[i]))
    }
  }
  return urls
}

function createUrls(isWeb, pak) {
  var pakRegExp = pak || '[\\w\\-\\.]+'
  if (!isWeb) {
    return [
      // /:pkg, dont contains scoped package
      new RegExp('^\\/' + pakRegExp + '$'),
      // /-/package/:pkg/dist-tags
      new RegExp('^\\/\\-\\/package\\/' + pakRegExp + '\\/dist-tags')
    ]
  }

  return [new RegExp('^\\/package\\/' + pakRegExp + '$')]
}

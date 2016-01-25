/**
 * marked-toc <https://github.com/jonschlinkert/marked-toc>
 *
 * Copyright (c) 2014 Jon Schlinkert, contributors.
 * Licensed under the MIT license.
 */

'use strict';

var fs = require('fs');
var marked = require('marked');
var matter = require('gray-matter');
var slugify = require('uslug');
var write = require('write');
var _ = require('lodash');
var striptags = require('striptags');
var utils = require('./lib/utils');

/**
 * Expose `toc`
 */

module.exports = toc;

/**
 * Default template to use for generating
 * a table of contents.
 */

var defaultTemplate = '<%= depth %><%= bullet %>[<%= heading %>](#<%= url %>)\n';

/**
 * Create the table of contents object that
 * will be used as context for the template.
 *
 * @param  {String} `str`
 * @param  {Object} `options`
 * @return {Object}
 */

function generate(str, options) {
  var opts = _.extend({
    firsth1: false,
    blacklist: true,
    omit: [],
    maxDepth: 3,
    slugifyOptions: { allowedChars: '-' },
    slugify: function(text) {
      return slugify(text, opts.slugifyOptions);
    }
  }, options);

  var toc = '';
  var tokens = marked.lexer(str);
  var tocArray = [];

  // Remove the very first h1, true by default
  if(opts.firsth1 === false) {
    tokens.shift();
  }

  // Do any h1's still exist?
  var h1 = _.any(tokens, {depth: 1});

  tokens.filter(function (token) {
    // Filter out everything but headings
    if (token.type !== 'heading' || token.type === 'code') {
      return false;
    }

    // Since we removed the first h1, we'll check to see if other h1's
    // exist. If none exist, then we unindent the rest of the TOC
    if(!h1) {
      token.depth = token.depth - 1;
    }

    // Store original text and create an id for linking
    token.heading = opts.strip ? utils.strip(token.text, opts) : token.text;

    // Create a "slugified" id for linking
    token.id = opts.slugify(striptags(token.text));

    // Omit headings with these strings
    var omissions = ['Table of Contents', 'TOC', 'TABLE OF CONTENTS'];
    var omit = _.union([], opts.omit, omissions);

    if (utils.isMatch(omit, token.heading)) {
      return;
    }

    return true;
  }).forEach(function (h) {

    if(h.depth > opts.maxDepth) {
      return;
    }

    var bullet = Array.isArray(opts.bullet)
      ? opts.bullet[(h.depth - 1) % opts.bullet.length]
      : opts.bullet;

    var data = _.extend({}, opts.data, {
      depth  : new Array((h.depth - 1) * 2 + 1).join(' '),
      bullet : bullet ? bullet : '* ',
      heading: h.heading,
      url    : h.id
    });

    tocArray.push(data);
    toc += _.template(opts.template || defaultTemplate, data);
  });

  return {
    data: tocArray,
    toc: opts.strip
      ? utils.strip(toc, opts)
      : toc
  };
}

/**
 * toc
 */

function toc(str, options) {
  return generate(str, options).toc;
}

toc.raw = function(str, options) {
  return generate(str, options);
};

toc.insert = function(str, options) {
  var start = '<!-- toc -->';
  var stop  = '<!-- tocstop -->';
  var re = /<!-- toc -->([\s\S]+?)<!-- tocstop -->/;

  var file = matter(str);
  var content = file.content;

  // remove the existing TOC
  content = content.replace(re, start);

  // generate new TOC
  var newtoc = '\n\n'
    + start + '\n\n'
    + toc(content, options) + '\n'
    + stop + '\n';

  // If front-matter existed, put it back
  var res = matter.stringify(content, file.data);
  return res.replace(start, newtoc);
};

/**
 * Add a table of contents to the given file. `dest` is optional.
 *
 * @param {String} `fp` File path
 * @param {String} `dest`
 * @param {String} `options`
 */

toc.add = function(fp, dest, options) {
  var opts = _.extend({strip: ['docs']}, options || {});
  var content = fs.readFileSync(fp, 'utf8');
  if (utils.isDest(dest)) {options = dest; dest = fp;}
  write.sync(dest, toc.insert(content, opts));
  console.log(' Success: ', dest);
};

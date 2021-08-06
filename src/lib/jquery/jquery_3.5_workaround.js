import $ from 'jquery';

// JQuery Hack: revert behaviour introduced in v.3.5
// See: https://jquery.com/upgrade-guide/3.5/
// eslint-disable-next-line no-useless-escape
const rxhtmlTag = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([a-z][^\/\0>\x20\t\r\n\f]*)[^>]*)\/>/gi;
$.htmlPrefilter = (html) => html.replace( rxhtmlTag, '<$1></$2>' );
mergeInto(LibraryManager.library, {
  FM27_Post: function (ptr) {
    var s = UTF8ToString(ptr);
    try { if (typeof window.fm27FromUnity === 'function') window.fm27FromUnity(s); } catch (e) { }
  }
});

/* Shared slide helpers: scale 1920x1080 slide to the window, render tech icons.
   Markup: <span class="tech" data-s="simple-icons-slug" data-f="fa-solid fa-...">Name</span>
   data-s is optional; without it (or if the CDN has no such icon) the Font Awesome icon is shown. */
(function(){
  document.querySelectorAll('.tech').forEach(function(el){
    var s = el.dataset.s, f = el.dataset.f || 'fa-solid fa-cube';
    var ico = document.createElement('span');
    ico.className = 'ico' + (s ? '' : ' nos');
    ico.innerHTML = (s ? '<img src="https://cdn.simpleicons.org/' + s + '" alt="" onerror="this.parentNode.classList.add(\'fb\')">' : '')
      + '<i class="fbk ' + f + '"></i>';
    el.insertBefore(ico, el.firstChild);
  });
  function fit(){
    var k = Math.min(innerWidth/1920, innerHeight/1080);
    document.getElementById('slide').style.transform = 'translate(-50%,-50%) scale(' + k + ')';
  }
  addEventListener('resize', fit); fit();
})();

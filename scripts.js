document.addEventListener('DOMContentLoaded', ()=>{
  document.querySelectorAll('.nav-toggle').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const inner = btn.closest('.nav-inner');
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      inner.classList.toggle('open');
    });
  });
});

// Close mobile nav when a link is clicked and set active nav link
document.addEventListener('DOMContentLoaded', ()=>{
  const navInner = document.querySelector('.nav-inner');
  if(!navInner) return;

  // Close mobile nav when any link is clicked
  navInner.querySelectorAll('a').forEach(a=>{
    a.addEventListener('click', ()=>{
      navInner.classList.remove('open');
      const toggle = navInner.querySelector('.nav-toggle');
      if(toggle) toggle.setAttribute('aria-expanded','false');
    });
  });

  // Add 'active' to current page link if href matches last segment
  const path = location.pathname.split('/').pop() || 'index.html';
  navInner.querySelectorAll('a').forEach(a=>{
    const href = a.getAttribute('href');
    if(href === path) a.classList.add('active');
  });
});

// Skip link: focus main content
document.addEventListener('DOMContentLoaded', ()=>{
  const skip = document.querySelector('.skip-link');
  if(!skip) return;
  skip.addEventListener('click', (e)=>{
    const main = document.getElementById('main-content');
    if(main){
      e.preventDefault();
      main.setAttribute('tabindex','-1');
      main.focus({preventScroll:false});
      window.scrollTo({top: main.offsetTop - 8, behavior: 'smooth'});
    }
  });
});
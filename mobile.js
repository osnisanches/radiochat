// Mobile-specific JavaScript functionality

document.addEventListener('DOMContentLoaded', function() {
  initMobileNavigation();
  initMobileModals();
  initBottomNavigation();
  initMobilePlayer();
  initMobileGallery();
  preventZoom();
});

// Mobile Navigation
function initMobileNavigation() {
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileNav = document.getElementById('mobileNav');
  const settingsBtn = document.getElementById('settingsBtn');
  const adminBtn = document.getElementById('adminBtn');

  if (mobileMenuBtn && mobileNav) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileNav.classList.toggle('open');
    });
  }

  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      openModal('settingsModal');
    });
  }

  if (adminBtn) {
    adminBtn.addEventListener('click', () => {
      window.location.href = './admin.html';
    });
  }
  const navCloseBtn = document.getElementById('navCloseBtn');
  const navLinks = document.querySelectorAll('.nav-link');

  if (mobileMenuBtn && mobileNav) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileNav.classList.add('open');
      document.body.style.overflow = 'hidden';
    });
  }

  if (navCloseBtn && mobileNav) {
    navCloseBtn.addEventListener('click', closeMobileNav);
  }

  // Close nav when clicking on links
  navLinks.forEach(link => {
    link.addEventListener('click', closeMobileNav);
  });

  // Close nav when clicking outside
  if (mobileNav) {
    document.addEventListener('click', (e) => {
      if (mobileNav.classList.contains('open') && 
          !mobileNav.contains(e.target) && 
          !mobileMenuBtn.contains(e.target)) {
        closeMobileNav();
      }
    });
  }

  function closeMobileNav() {
    if (mobileNav) {
      mobileNav.classList.remove('open');
      document.body.style.overflow = '';
    }
  }
}

// Mobile Modals
function initMobileModals() {
  // Chat Modal
  const chatToggleBtn = document.getElementById('chatToggleBtn');
  const chatModal = document.getElementById('chatModal');
  const closeChatBtn = document.getElementById('closeChatBtn');

  if (chatToggleBtn && chatModal) {
    chatToggleBtn.addEventListener('click', () => {
      showModal(chatModal);
      if (typeof renderChat === 'function') {
        renderChat();
      }
      toggleBrandLogoPlayer(true);
    });
  }

  if (closeChatBtn && chatModal) {
    closeChatBtn.addEventListener('click', () => {
      hideModal(chatModal);
      toggleBrandLogoPlayer(false);
    });
  }

  // Request Modal
  const requestToggleBtn = document.getElementById('requestToggleBtn');
  const requestModal = document.getElementById('requestModal');
  const closeRequestBtn = document.getElementById('closeRequestBtn');

  if (requestToggleBtn && requestModal) {
    requestToggleBtn.addEventListener('click', () => {
      showModal(requestModal);
      toggleBrandLogoPlayer(true);
    });
  }

  if (closeRequestBtn && requestModal) {
    closeRequestBtn.addEventListener('click', () => {
      hideModal(requestModal);
      toggleBrandLogoPlayer(false);
    });
  }

  // Settings Modal
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsModal = document.getElementById('settingsModal');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');

  if (settingsBtn && settingsModal) {
    settingsBtn.addEventListener('click', () => {
      showModal(settingsModal);
      toggleBrandLogoPlayer(true);
    });
  }

  if (closeSettingsBtn && settingsModal) {
    closeSettingsBtn.addEventListener('click', () => {
      hideModal(settingsModal);
      toggleBrandLogoPlayer(false);
    });
  }

  // Close modals when clicking outside
  document.addEventListener('click', (e) => {
    const modals = document.querySelectorAll('.modal.show');
    modals.forEach(modal => {
      if (e.target === modal) {
        hideModal(modal);
        toggleBrandLogoPlayer(false);
      }
    });
  });
}

function toggleBrandLogoPlayer(active) {
  const logo = document.getElementById('brandLogoBtn');
  const audio = document.getElementById('radioAudio');
  const playBtn = document.getElementById('playPauseBtn');
  if (!logo || !audio || !playBtn) return;
  if (active) {
    logo.classList.add('player');
    const icon = audio.paused ? 'play_arrow' : 'pause';
    logo.innerHTML = `<span class="material-icons">${icon}</span>`;
    logo.setAttribute('aria-label', audio.paused ? 'Reproduzir' : 'Pausar');
    const handler = () => { playBtn.click(); };
    logo._playerHandler && logo.removeEventListener('click', logo._playerHandler);
    logo._playerHandler = handler;
    logo.addEventListener('click', handler);
  } else {
    logo.classList.remove('player');
    logo.textContent = 'AR';
    logo.setAttribute('aria-label', 'Aluno Repórter');
    if (logo._playerHandler) {
      logo.removeEventListener('click', logo._playerHandler);
      logo._playerHandler = null;
    }
  }
}

function showModal(modal) {
  if (modal) {
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    document.body.classList.add('no-scroll');
    document.documentElement.classList.add('no-scroll');
  }
}

function hideModal(modal) {
  if (modal) {
    modal.classList.remove('show');
    document.body.style.overflow = '';
    document.body.classList.remove('no-scroll');
    document.documentElement.classList.remove('no-scroll');
  }
}

// Bottom Navigation
function initBottomNavigation() {
  const bottomNavItems = document.querySelectorAll('.bottom-nav-item');
  const chatModal = document.getElementById('chatModal');
  const requestModal = document.getElementById('requestModal');
  const identityModal = document.getElementById('identityModal');
  
  bottomNavItems.forEach(item => {
    item.addEventListener('click', (e) => {
      const href = item.getAttribute('href');
      
      // Open modals for Chat, Pedidos e Identidade em vez de scroll
      if (href === '#chat') {
        e.preventDefault();
        bottomNavItems.forEach(navItem => navItem.classList.remove('active'));
        item.classList.add('active');
        showModal(chatModal);
        toggleBrandLogoPlayer(true);
        return;
      }
      if (href === '#requests') {
        e.preventDefault();
        bottomNavItems.forEach(navItem => navItem.classList.remove('active'));
        item.classList.add('active');
        showModal(requestModal);
        toggleBrandLogoPlayer(true);
        return;
      }
      if (href === '#identity') {
        e.preventDefault();
        bottomNavItems.forEach(navItem => navItem.classList.remove('active'));
        item.classList.add('active');
        showModal(identityModal);
        toggleBrandLogoPlayer(true);
        return;
      }
      
      e.preventDefault();
      
      bottomNavItems.forEach(navItem => {
        navItem.classList.remove('active');
      });
      
      item.classList.add('active');
      
      if (href && href.startsWith('#')) {
        const target = document.querySelector(href);
        if (target) {
          const headerHeight = 60;
          const targetPosition = target.offsetTop - headerHeight;
          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });
        }
      }
    });
  });

  window.addEventListener('scroll', updateActiveNavItem);
}

function updateActiveNavItem() {
  // Não atualizar enquanto qualquer modal estiver aberto
  if (document.querySelector('.modal.show')) return;
  const sections = ['hero', 'player', 'chat', 'requests', 'gallery'];
  const headerHeight = 60;
  const scrollPosition = window.scrollY + headerHeight + 100;

  let activeSection = 'hero';

  sections.forEach(sectionId => {
    const section = document.getElementById(sectionId);
    if (section && scrollPosition >= section.offsetTop) {
      activeSection = sectionId;
    }
  });

  // Update bottom nav
  const bottomNavItems = document.querySelectorAll('.bottom-nav-item');
  bottomNavItems.forEach(item => {
    item.classList.remove('active');
    if (item.getAttribute('href') === `#${activeSection}`) {
      item.classList.add('active');
    }
  });
}

// Mobile Player Enhancements
function initMobilePlayer() {
  const volumeSlider = document.getElementById('volumeSlider');
  const volumeSliderSettings = document.getElementById('volumeSliderSettings');

  // Sync volume sliders
  if (volumeSlider && volumeSliderSettings) {
    volumeSlider.addEventListener('input', (e) => {
      volumeSliderSettings.value = e.target.value;
    });

    volumeSliderSettings.addEventListener('input', (e) => {
      volumeSlider.value = e.target.value;
    });
  }

  // Add haptic feedback for play button (if supported)
  const playBtn = document.getElementById('playPauseBtn');
  if (playBtn && 'vibrate' in navigator) {
    playBtn.addEventListener('click', () => {
      navigator.vibrate(50); // Short vibration
    });
  }
}

// Mobile Gallery Enhancements
function initMobileGallery() {
  // Add touch gestures for gallery items
  const galleryItems = document.querySelectorAll('.gallery-item');
  
  galleryItems.forEach(item => {
    let touchStartTime = 0;
    
    item.addEventListener('touchstart', (e) => {
      touchStartTime = Date.now();
    });
    
    item.addEventListener('touchend', (e) => {
      const touchDuration = Date.now() - touchStartTime;
      
      // If it's a quick tap (less than 200ms), treat as click
      if (touchDuration < 200) {
        e.preventDefault();
        item.click();
      }
    });
  });
}

// Prevent zoom on double tap
function preventZoom() {
  let lastTouchEnd = 0;
  
  document.addEventListener('touchend', function(event) {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, false);

  // Prevent zoom on input focus
  const inputs = document.querySelectorAll('input, textarea');
  inputs.forEach(input => {
    input.addEventListener('focus', () => {
      document.querySelector('meta[name=viewport]').setAttribute(
        'content', 
        'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no'
      );
    });

    input.addEventListener('blur', () => {
      document.querySelector('meta[name=viewport]').setAttribute(
        'content', 
        'width=device-width, initial-scale=1, user-scalable=no'
      );
    });
  });
}

// Mobile-specific toast function
function showMobileToast(message, duration = 3000) {
  const toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;

  toastContainer.appendChild(toast);

  // Auto remove after duration
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, duration);
}

// Share functionality for mobile
function initMobileShare() {
  const shareButtons = [
    document.getElementById('shareBtn'),
    document.getElementById('shareBtnTop'),
    document.getElementById('shareBtnPlayer')
  ].filter(Boolean);

  if (!shareButtons.length) return;

  shareButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const shareData = {
        title: document.title || 'Aluno Repórter',
        text: 'Ouça a rádio e participe do chat!',
        url: window.location.href
      };

      if (navigator.share) {
        try {
          await navigator.share(shareData);
        } catch (err) {
          console.warn('Compartilhamento cancelado ou falhou:', err);
        }
      } else {
        try {
          await navigator.clipboard.writeText(shareData.url);
          showToast('Link copiado para a área de transferência!');
        } catch (e) {
          showToast('Não foi possível copiar o link.');
        }
      }
    });
  });
}

function fallbackShare() {
  const url = window.location.href;
  
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      showMobileToast('Link copiado para a área de transferência!');
    });
  } else {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = url;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    showMobileToast('Link copiado!');
  }
}

// Initialize share functionality
document.addEventListener('DOMContentLoaded', initMobileShare);

// Handle orientation change
window.addEventListener('orientationchange', () => {
  // Delay to ensure the orientation change is complete
  setTimeout(() => {
    // Recalculate positions if needed
    updateActiveNavItem();
  }, 100);
});

// Service Worker registration for mobile
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

// Add to home screen prompt
let mobileDeferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later
  mobileDeferredPrompt = e;
  
  // Show install button or banner
  showInstallPrompt();
});

function showInstallPrompt() {
  // You can show a custom install prompt here
  const installBanner = document.createElement('div');
  installBanner.innerHTML = `
    <div style="
      position: fixed;
      bottom: 80px;
      left: 1rem;
      right: 1rem;
      background: var(--primary-color);
      color: white;
      padding: 1rem;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 2000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    ">
      <span>Instalar app na tela inicial?</span>
      <div>
        <button id="installBtn" style="
          background: white;
          color: var(--primary-color);
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          margin-right: 0.5rem;
          cursor: pointer;
        ">Instalar</button>
        <button id="dismissBtn" style="
          background: transparent;
          color: white;
          border: 1px solid white;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          cursor: pointer;
        ">Não</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(installBanner);
  
  document.getElementById('installBtn').addEventListener('click', () => {
    if (mobileDeferredPrompt) {
      mobileDeferredPrompt.prompt();
      mobileDeferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the A2HS prompt');
        }
        mobileDeferredPrompt = null;
      });
    }
    document.body.removeChild(installBanner);
  });
  
  document.getElementById('dismissBtn').addEventListener('click', () => {
    document.body.removeChild(installBanner);
  });
  
  // Auto dismiss after 10 seconds
  setTimeout(() => {
    if (installBanner.parentNode) {
      document.body.removeChild(installBanner);
    }
  }, 10000);
}

function movePlayerControlsToHeader(active) {
  const headerActions = document.querySelector('.mobile-header .mobile-actions');
  const playerControls = document.querySelector('.player-controls');

  if (!headerActions || !playerControls) return;

  const playBtn = document.getElementById('playPauseBtn');
  const volumeControl = playerControls.querySelector('.volume-control');

  if (!playBtn || !volumeControl) return;

  if (active) {
    // Oculta controles do player na seção e move para o header
    playerControls.style.display = 'none';
    headerActions.appendChild(playBtn);
    headerActions.appendChild(volumeControl);
  } else {
    // Restaura controles para a seção do player
    playerControls.style.display = '';
    playerControls.insertBefore(playBtn, playerControls.firstChild.nextSibling);
    playerControls.appendChild(volumeControl);
  }
}

function initMobilePlayer() {
  const playBtn = document.getElementById('playPauseBtn');
  const volumeControl = document.querySelector('.player-controls .volume-control');
  const volumeIcon = volumeControl ? volumeControl.querySelector('.material-icons') : null;

  if (playBtn && 'vibrate' in navigator) {
    playBtn.addEventListener('click', () => {
      navigator.vibrate(50);
    });
  }

  // Toggle de exibição do slider ao clicar no ícone de volume (mesmo padrão de clique do play/pause)
  if (volumeControl && volumeIcon) {
    volumeIcon.style.cursor = 'pointer';
    volumeIcon.addEventListener('click', () => {
      volumeControl.classList.toggle('open');
      const slider = volumeControl.querySelector('#volumeRange');
      if (slider) {
        setTimeout(() => {
          slider.focus();
        }, 0);
      }
    });
  }
}
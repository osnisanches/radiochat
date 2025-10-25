// Admin Mobile (mobile-first) integrated with Netlify function API

class AdminMobileApp {
  constructor() {
    this.token = null; // ADMIN_PASSWORD provided by user
    this.photos = []; // array of { name, url }
    this.mode = 'single';
    this.featured = null; // name of featured photo
    this.currentPhotoName = null;
    this.endpoints = {
      admin: '/.netlify/functions/admin',
    };
    this.init();
  }

  init() {
    document.addEventListener('DOMContentLoaded', () => {
      this.bindLogin();
      this.bindUpload();
      this.bindModals();
      this.bindQuickActions();
      this.bindLogout();
    });
  }

  // ===== Login =====
  bindLogin() {
    const loginBtn = document.getElementById('loginBtn');
    const adminPass = document.getElementById('adminPass');
    const loginSection = document.getElementById('loginSection');
    const adminContent = document.getElementById('adminContent');
    const logoutBtn = document.getElementById('logoutBtn');

    if (!loginBtn || !adminPass) return;

    loginBtn.addEventListener('click', async () => {
      const password = (adminPass.value || '').trim();
      if (!password) return this.showLoginError('Digite a senha');

      this.showLoading(true);
      try {
        const res = await fetch(this.endpoints.admin, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Token': password },
          body: JSON.stringify({ action: 'auth_check' })
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          this.token = password;
          loginSection.style.display = 'none';
          adminContent.style.display = 'block';
          logoutBtn.style.display = 'block';
          this.showToast('Login realizado com sucesso!', 'success');
          await this.loadPhotos();
        } else {
          this.showLoginError('Senha incorreta');
        }
      } catch (e) {
        this.showLoginError('Erro de conexão');
      } finally {
        this.showLoading(false);
      }
    });

    adminPass.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') loginBtn.click();
    });
  }

  showLoginError(message) {
    const el = document.getElementById('loginStatus');
    if (!el) return;
    el.textContent = message;
    el.className = 'login-status error';
    setTimeout(() => {
      el.textContent = '';
      el.className = 'login-status';
    }, 3000);
  }

  // ===== Photos load/display =====
  async loadPhotos() {
    try {
      const res = await fetch(`${this.endpoints.admin}?type=photos`);
      const data = await res.json();
      if (!res.ok) throw new Error('Falha ao obter fotos');
      const { urls = [], names = [], mode = 'single', featured = null } = data || {};
      this.mode = mode;
      this.featured = featured;
      this.photos = names.map((name, i) => ({ name, url: urls[i] }));
      this.displayPhotos();
      this.updateCoverPreview();
      this.updateSystemStatus();
    } catch (e) {
      console.error('loadPhotos error', e);
      this.showToast('Erro ao carregar fotos', 'error');
    }
  }

  displayPhotos() {
    const photosList = document.getElementById('photosList');
    if (!photosList) return;
    photosList.innerHTML = '';

    if (this.photos.length === 0) {
      photosList.innerHTML = '<div class="no-photos">Nenhuma foto disponível</div>';
      return;
    }

    this.photos.forEach((photo, index) => {
      const item = document.createElement('div');
      item.className = 'photo-item';
      item.innerHTML = `
        <img src="${photo.url}" alt="Foto ${index + 1}" loading="lazy" />
        <div class="photo-overlay">
          <button class="photo-action" data-name="${photo.name}">
            <span class="material-icons">visibility</span>
          </button>
        </div>
      `;
      item.querySelector('.photo-action').addEventListener('click', () => {
        this.viewPhoto(photo.name);
      });
      photosList.appendChild(item);
    });
  }

  updateCoverPreview() {
    const coverPreview = document.getElementById('coverPreview');
    const noCoverMessage = document.getElementById('noCoverMessage');
    if (!coverPreview || !noCoverMessage) return;

    const featuredPhoto = this.photos.find(p => p.name === this.featured);
    if (featuredPhoto) {
      coverPreview.src = featuredPhoto.url;
      coverPreview.style.display = 'block';
      noCoverMessage.style.display = 'none';
    } else {
      coverPreview.style.display = 'none';
      noCoverMessage.style.display = 'block';
    }
  }

  // ===== Upload =====
  bindUpload() {
    const uploadTrigger = document.getElementById('uploadTrigger');
    const photoInput = document.getElementById('photoInput');
    if (!uploadTrigger || !photoInput) return;

    uploadTrigger.addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', (e) => this.handleUpload(e));
  }

  async handleUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.showToast('Por favor, selecione uma imagem válida', 'error');
      return;
    }
    this.showLoading(true);
    try {
      const dataUrl = await this.fileToDataUrl(file, 1600);
      const match = /^data:(.*?);base64,(.*)$/.exec(dataUrl);
      if (!match) throw new Error('Formato de data URL inválido');
      const contentType = match[1];
      const base64Data = match[2];

      const res = await fetch(this.endpoints.admin, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': this.token || '' },
        body: JSON.stringify({ action: 'upload_photo', filename: file.name, contentType, data: base64Data })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        this.showToast('Foto enviada com sucesso!', 'success');
        await this.loadPhotos();
      } else {
        this.showToast('Erro ao enviar foto', 'error');
      }
    } catch (e) {
      console.error('upload error', e);
      this.showToast('Erro ao processar imagem', 'error');
    } finally {
      this.showLoading(false);
      e.target.value = '';
    }
  }

  // ===== Photo modal / actions =====
  bindModals() {
    const photoModal = document.getElementById('photoModal');
    const closePhotoModal = document.getElementById('closePhotoModal');
    const setCoverBtn = document.getElementById('setCoverBtn');
    const deletePhotoBtn = document.getElementById('deletePhotoBtn');

    if (closePhotoModal) closePhotoModal.addEventListener('click', () => this.hideModal(photoModal));
    if (setCoverBtn) setCoverBtn.addEventListener('click', () => this.setCoverFromCurrent());
    if (deletePhotoBtn) deletePhotoBtn.addEventListener('click', () => this.confirmDeleteCurrent());
  }

  viewPhoto(name) {
    const photo = this.photos.find(p => p.name === name);
    if (!photo) return;
    this.currentPhotoName = name;
    const modalPhoto = document.getElementById('modalPhoto');
    const photoModal = document.getElementById('photoModal');
    if (modalPhoto) modalPhoto.src = photo.url;
    this.showModal(photoModal);
  }

  async setCoverFromCurrent() {
    if (!this.currentPhotoName) return;
    this.showLoading(true);
    try {
      const res = await fetch(this.endpoints.admin, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': this.token || '' },
        body: JSON.stringify({ action: 'set_cover_mode', mode: 'single', featured: this.currentPhotoName })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        this.featured = this.currentPhotoName;
        this.updateCoverPreview();
        this.showToast('Foto definida como capa!', 'success');
        this.hideModal(document.getElementById('photoModal'));
      } else {
        this.showToast('Erro ao definir capa', 'error');
      }
    } catch (e) {
      this.showToast('Erro de conexão', 'error');
    } finally {
      this.showLoading(false);
    }
  }

  confirmDeleteCurrent() {
    if (!this.currentPhotoName) return;
    this.showConfirmModal('Tem certeza que deseja excluir esta foto?', async () => {
      await this.deletePhoto(this.currentPhotoName);
    });
  }

  async deletePhoto(name) {
    this.showLoading(true);
    try {
      const res = await fetch(this.endpoints.admin, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': this.token || '' },
        body: JSON.stringify({ action: 'delete_photo', name })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        this.showToast('Foto excluída com sucesso!', 'success');
        this.hideModal(document.getElementById('photoModal'));
        await this.loadPhotos();
      } else {
        this.showToast('Erro ao excluir foto', 'error');
      }
    } catch (e) {
      this.showToast('Erro de conexão', 'error');
    } finally {
      this.showLoading(false);
    }
  }

  // ===== Quick actions =====
  bindQuickActions() {
    const refreshGalleryBtn = document.getElementById('refreshGalleryBtn');
    const clearCacheBtn = document.getElementById('clearCacheBtn');
    const exportDataBtn = document.getElementById('exportDataBtn');

    if (refreshGalleryBtn) refreshGalleryBtn.addEventListener('click', () => { this.loadPhotos(); this.showToast('Galeria atualizada!', 'info'); });
    if (clearCacheBtn) clearCacheBtn.addEventListener('click', () => {
      if ('caches' in window) {
        caches.keys().then(names => names.forEach(name => caches.delete(name)));
      }
      this.showToast('Cache limpo!', 'info');
    });
    if (exportDataBtn) exportDataBtn.addEventListener('click', () => this.exportData());
  }

  exportData() {
    const payload = {
      photos: this.photos,
      mode: this.mode,
      featured: this.featured,
      timestamp: new Date().toISOString(),
      version: '1.0'
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `radio-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast('Dados exportados!', 'success');
  }

  // ===== Logout =====
  bindLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    const loginSection = document.getElementById('loginSection');
    const adminContent = document.getElementById('adminContent');
    if (!logoutBtn) return;
    logoutBtn.addEventListener('click', () => {
      this.token = null;
      loginSection.style.display = 'block';
      adminContent.style.display = 'none';
      logoutBtn.style.display = 'none';
      const adminPass = document.getElementById('adminPass');
      if (adminPass) adminPass.value = '';
      this.showToast('Logout realizado com sucesso!', 'info');
    });
  }

  // ===== UI helpers =====
  showModal(modal) {
    if (!modal) return;
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    document.body.classList.add('no-scroll');
    document.documentElement.classList.add('no-scroll');
  }
  hideModal(modal) {
    if (!modal) return;
    modal.classList.remove('show');
    document.body.style.overflow = '';
    document.body.classList.remove('no-scroll');
    document.documentElement.classList.remove('no-scroll');
  }
  showConfirmModal(message, onConfirm) {
    const confirmModal = document.getElementById('confirmModal');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmYes = document.getElementById('confirmYes');
    const confirmNo = document.getElementById('confirmNo');
    if (!confirmModal || !confirmMessage || !confirmYes || !confirmNo) return;

    confirmMessage.textContent = message;
    const handleYes = () => { onConfirm?.(); this.hideModal(confirmModal); cleanup(); };
    const handleNo = () => { this.hideModal(confirmModal); cleanup(); };
    function cleanup(){
      confirmYes.removeEventListener('click', handleYes);
      confirmNo.removeEventListener('click', handleNo);
    }
    confirmYes.addEventListener('click', handleYes);
    confirmNo.addEventListener('click', handleNo);
    this.showModal(confirmModal);
  }
  showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = show ? 'flex' : 'none';
  }
  showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 3000);
  }

  async fileToDataUrl(file, maxW = 1024) {
    const img = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = fr.result;
      };
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, maxW / img.width);
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  }
}

// Initialize app
new AdminMobileApp();
/**
 * app.js - Main Application Controller
 */

// Global State
const state = {
  exhibitions: [],
  filteredExhibitions: [],
  savedExhibitions: [],
  selectedRegion: "전체",
  searchQuery: "",
  filters: {
    freeOnly: false,
    cultureDayOnly: false,
    thisWeekendOnly: false,
    thisMonthOnly: true,
    ongoingOnly: true
  },
  sortBy: "endingSoon"
};

// DOM References
const elements = {
  cardsGrid: document.getElementById('cards-grid'),
  searchField: document.getElementById('exhibition-search'),
  filterFree: document.getElementById('filter-free-only'),
  filterCulture: document.getElementById('filter-culture-day'),
  filterWeekend: document.getElementById('filter-weekend'),
  filterMonth: document.getElementById('filter-month'),
  filterOngoing: document.getElementById('filter-ongoing'),
  sortSelect: document.getElementById('exhibition-sort'),
  currentRegionDisplay: document.getElementById('current-region-display'),
  toolbarStatsText: document.getElementById('toolbar-stats-text'),
  resetRegionBtn: document.getElementById('reset-region-btn'),
  
  // Status banner
  statusBanner: document.getElementById('status-banner'),
  statusBannerText: document.getElementById('status-banner-text'),
  statusBannerClose: document.getElementById('status-banner-close'),
  
  // Settings Dialog (Multi-Keys & Endpoints)
  settingsToggleBtn: document.getElementById('settings-toggle-btn'),
  settingsBackdrop: document.getElementById('settings-backdrop'),
  settingsModal: document.getElementById('settings-modal'),
  settingsCloseBtn: document.getElementById('settings-close'),
  settingsSaveBtn: document.getElementById('settings-save'),
  settingsTourKey: document.getElementById('settings-tour-key'),
  settingsCultureKey: document.getElementById('settings-culture-key'),
  settingsEndpointType: document.getElementById('settings-endpoint-type'),
  tourKeySourceInfo: document.getElementById('tour-key-source-info'),
  cultureKeySourceInfo: document.getElementById('culture-key-source-info'),
  
  // Calendar Drawer
  calendarFab: document.getElementById('calendar-fab'),
  calendarFabBadge: document.getElementById('calendar-fab-badge'),
  drawerBackdrop: document.getElementById('drawer-backdrop'),
  calendarDrawer: document.getElementById('calendar-drawer'),
  drawerCloseBtn: document.getElementById('drawer-close'),
  clearAllSavedBtn: document.getElementById('clear-all-saved'),
  
  // Saved stats
  weekendVisitCount: document.getElementById('weekend-visit-count'),
  savedFreeCount: document.getElementById('saved-free-count'),
  estimatedTotalCost: document.getElementById('estimated-total-cost'),
  
  // Saved list slots
  weekendSectionCount: document.getElementById('weekend-section-count'),
  allSectionCount: document.getElementById('all-section-count'),
  weekendSavedList: document.getElementById('weekend-saved-list'),
  allSavedList: document.getElementById('all-saved-list'),
  
  // Mobile elements
  mobileChipsContainer: document.getElementById('mobile-chips-container'),
  mobileMapToggle: document.getElementById('mobile-map-toggle'),
  mapSidebarCard: document.getElementById('map-sidebar-card'),
  sidebarPanel: document.getElementById('sidebar-panel')
};

// -------------------------------------------------------------
// Initialization
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // 1. Load configuration metadata to UI
  syncSettingsFromConfig();

  // 2. Load saved exhibitions from localStorage
  if (window.StorageModule) {
    state.savedExhibitions = window.StorageModule.getSavedExhibitions();
    updateCalendarFabBadge();
  }

  // 3. Initialize Interactive Map
  if (window.MapModule) {
    window.MapModule.initMap('map-container', (selectedRegion) => {
      if (state.selectedRegion === selectedRegion) {
        state.selectedRegion = "전체";
        window.MapModule.highlightRegion("전체");
      } else {
        state.selectedRegion = selectedRegion;
      }
      
      elements.currentRegionDisplay.textContent = state.selectedRegion === "전체" ? "전국 전시" : `${state.selectedRegion} 전시`;
      applyFiltersAndRender();
      
      // Close map accordion on mobile after selecting a region
      if (elements.mapSidebarCard.classList.contains('mobile-visible')) {
        elements.mapSidebarCard.classList.remove('mobile-visible');
        elements.mobileMapToggle.setAttribute('aria-expanded', 'false');
        elements.mobileMapToggle.querySelector('span').textContent = "전국 지역 격자 지도 보기";
      }
    });
  }

  // 4. Attach Event Listeners
  setupEventListeners();

  // 5. Load Initial Data
  loadData();
});

// -------------------------------------------------------------
// Load Configuration into Settings Panel inputs
// -------------------------------------------------------------
function syncSettingsFromConfig() {
  if (!window.ApiModule) return;
  const config = window.ApiModule.getApiConfig();
  
  // Tour Key configuration
  if (config.isTourKeyFromFile) {
    elements.settingsTourKey.value = "••••••••••••••••••••";
    elements.settingsTourKey.disabled = true;
    elements.tourKeySourceInfo.textContent = "🔒 로컬 설정 파일(js/config.js)로부터 보호됨 (수정 불가)";
    elements.tourKeySourceInfo.style.color = "var(--color-free)";
  } else {
    elements.settingsTourKey.value = config.tourKey;
    elements.settingsTourKey.disabled = false;
    elements.tourKeySourceInfo.textContent = config.tourKey ? "🔑 로컬 브라우저 저장소(localStorage)에 보관됨" : "❌ 등록된 키 없음 (로컬 저장소)";
    elements.tourKeySourceInfo.style.color = config.tourKey ? "var(--color-primary)" : "var(--color-muted)";
  }

  // Culture Key configuration
  if (config.isCultureKeyFromFile) {
    elements.settingsCultureKey.value = "••••••••••••••••••••";
    elements.settingsCultureKey.disabled = true;
    elements.cultureKeySourceInfo.textContent = "🔒 로컬 설정 파일(js/config.js)로부터 보호됨 (수정 불가)";
    elements.cultureKeySourceInfo.style.color = "var(--color-free)";
  } else {
    elements.settingsCultureKey.value = config.cultureKey;
    elements.settingsCultureKey.disabled = false;
    elements.cultureKeySourceInfo.textContent = config.cultureKey ? "🔑 로컬 브라우저 저장소(localStorage)에 보관됨" : "❌ 등록된 키 없음 (로컬 저장소)";
    elements.cultureKeySourceInfo.style.color = config.cultureKey ? "var(--color-primary)" : "var(--color-muted)";
  }

  // Endpoint configuration
  elements.settingsEndpointType.value = config.endpointType;
}

// -------------------------------------------------------------
// Data Loading
// -------------------------------------------------------------
async function loadData() {
  elements.cardsGrid.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">🔄</div>
      <h3>전시 정보를 불러오는 중입니다...</h3>
      <p>실시간 공공 API 호출 및 정규화 작업을 진행하고 있습니다.</p>
    </div>
  `;
  
  if (window.ApiModule) {
    state.exhibitions = await window.ApiModule.fetchExhibitions();
    updateStatusBanner();
    
    if (window.MapModule) {
      window.MapModule.updateMapStats(state.exhibitions, state.selectedRegion);
    }
    
    applyFiltersAndRender();
  }
}

// -------------------------------------------------------------
// Event Handlers Setup
// -------------------------------------------------------------
function setupEventListeners() {
  // Search input debouncer
  let searchTimeout;
  elements.searchField.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.searchQuery = e.target.value;
      applyFiltersAndRender();
    }, 250);
  });

  // Filters checkbox changes
  const checkboxes = [
    { el: elements.filterFree, key: 'freeOnly' },
    { el: elements.filterCulture, key: 'cultureDayOnly' },
    { el: elements.filterWeekend, key: 'thisWeekendOnly' },
    { el: elements.filterMonth, key: 'thisMonthOnly' },
    { el: elements.filterOngoing, key: 'ongoingOnly' }
  ];

  checkboxes.forEach(chk => {
    if (chk.el) {
      chk.el.addEventListener('change', (e) => {
        state.filters[chk.key] = e.target.checked;
        syncCheckboxWithMobileChips(chk.key, e.target.checked);
        applyFiltersAndRender();
      });
    }
  });

  // Sort Selector
  elements.sortSelect.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    applyFiltersAndRender();
  });

  // Reset Region filter
  elements.resetRegionBtn.addEventListener('click', () => {
    state.selectedRegion = "전체";
    elements.currentRegionDisplay.textContent = "전국 전시";
    if (window.MapModule) {
      window.MapModule.highlightRegion("전체");
    }
    applyFiltersAndRender();
  });

  // Status Banner Close
  elements.statusBannerClose.addEventListener('click', () => {
    elements.statusBanner.style.display = 'none';
  });

  // Calendar Drawer Controls
  elements.calendarFab.addEventListener('click', openCalendarDrawer);
  elements.drawerCloseBtn.addEventListener('click', closeCalendarDrawer);
  elements.drawerBackdrop.addEventListener('click', closeCalendarDrawer);

  // Settings Modal Controls
  elements.settingsToggleBtn.addEventListener('click', openSettingsModal);
  elements.settingsCloseBtn.addEventListener('click', closeSettingsModal);
  elements.settingsBackdrop.addEventListener('click', closeSettingsModal);

  // Save Settings Modal overrides
  elements.settingsSaveBtn.addEventListener('click', () => {
    if (!window.ApiModule) return;
    const config = window.ApiModule.getApiConfig();
    
    const overrides = {
      endpointType: elements.settingsEndpointType.value
    };
    
    // Save keys only if editable (not from file)
    if (!config.isTourKeyFromFile) {
      overrides.tourKey = elements.settingsTourKey.value;
    }
    if (!config.isCultureKeyFromFile) {
      overrides.cultureKey = elements.settingsCultureKey.value;
    }
    
    window.ApiModule.saveApiConfig(overrides);
    closeSettingsModal();
    syncSettingsFromConfig();
    showTemporaryFloatingNotice("API 설정이 저장되었습니다. 데이터를 갱신합니다.");
    loadData();
  });

  // ESC Close for Drawer Modals
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCalendarDrawer();
      closeSettingsModal();
    }
  });

  // Clear all saved
  elements.clearAllSavedBtn.addEventListener('click', () => {
    if (state.savedExhibitions.length === 0) return;
    
    if (confirm("내 주말 캘린더에 담긴 모든 전시를 삭제하시겠습니까?")) {
      if (window.StorageModule) {
        window.StorageModule.clearSavedExhibitions();
        state.savedExhibitions = [];
        updateCalendarFabBadge();
        renderExhibitions();
        renderDrawerContent();
        showTemporaryFloatingNotice("캘린더를 모두 비웠습니다.");
      }
    }
  });

  // Mobile Map drawer toggle
  elements.mobileMapToggle.addEventListener('click', () => {
    const isVisible = elements.mapSidebarCard.classList.contains('mobile-visible');
    if (isVisible) {
      elements.mapSidebarCard.classList.remove('mobile-visible');
      elements.mobileMapToggle.setAttribute('aria-expanded', 'false');
      elements.mobileMapToggle.querySelector('span').textContent = "전국 지역 격자 지도 보기";
    } else {
      elements.mapSidebarCard.classList.add('mobile-visible');
      elements.mobileMapToggle.setAttribute('aria-expanded', 'true');
      elements.mobileMapToggle.querySelector('span').textContent = "지도 접기";
    }
  });

  // Mobile quick filters chips click event
  if (elements.mobileChipsContainer) {
    elements.mobileChipsContainer.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip-btn');
      if (!chip) return;
      
      const filterType = chip.getAttribute('data-filter');
      
      elements.mobileChipsContainer.querySelectorAll('.chip-btn').forEach(btn => btn.classList.remove('active'));
      chip.classList.add('active');
      
      if (filterType === 'all') {
        state.selectedRegion = "전체";
        elements.currentRegionDisplay.textContent = "전국 전시";
        if (window.MapModule) window.MapModule.highlightRegion("전체");
        
        state.filters.freeOnly = false;
        state.filters.cultureDayOnly = false;
        state.filters.thisWeekendOnly = false;
      } 
      else if (filterType === 'free') {
        state.filters.freeOnly = !state.filters.freeOnly;
        chip.classList.toggle('active', state.filters.freeOnly);
      } 
      else if (filterType === 'culture') {
        state.filters.cultureDayOnly = !state.filters.cultureDayOnly;
        chip.classList.toggle('active', state.filters.cultureDayOnly);
      } 
      else if (filterType === 'weekend') {
        state.filters.thisWeekendOnly = !state.filters.thisWeekendOnly;
        chip.classList.toggle('active', state.filters.thisWeekendOnly);
      }
      
      syncStateToSidebarCheckbox();
      applyFiltersAndRender();
    });
  }
}

// Helper to keep checkbox inputs and mobile chips synchronized
function syncCheckboxWithMobileChips(filterKey, isChecked) {
  let chipId = '';
  if (filterKey === 'freeOnly') chipId = 'mobile-chip-free';
  if (filterKey === 'cultureDayOnly') chipId = 'mobile-chip-culture';
  if (filterKey === 'thisWeekendOnly') chipId = 'mobile-chip-weekend';
  
  const chip = document.getElementById(chipId);
  if (chip) {
    chip.classList.toggle('active', isChecked);
  }
}

function syncStateToSidebarCheckbox() {
  if (elements.filterFree) elements.filterFree.checked = state.filters.freeOnly;
  if (elements.filterCulture) elements.filterCulture.checked = state.filters.cultureDayOnly;
  if (elements.filterWeekend) elements.filterWeekend.checked = state.filters.thisWeekendOnly;
}

// -------------------------------------------------------------
// Filters Coordinator & Renders
// -------------------------------------------------------------
function applyFiltersAndRender() {
  if (!window.FiltersModule) return;
  
  let filtered = window.FiltersModule.filterExhibitions(
    state.exhibitions,
    state.filters,
    state.selectedRegion,
    state.searchQuery
  );
  
  state.filteredExhibitions = window.FiltersModule.sortExhibitions(
    filtered,
    state.sortBy
  );

  renderExhibitions();
  updateToolbarStats();
}

function renderExhibitions() {
  elements.cardsGrid.innerHTML = '';
  
  if (state.filteredExhibitions.length === 0) {
    elements.cardsGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <h3>조건에 맞는 전시가 없습니다.</h3>
        <p>검색어를 바꾼 뒤 검색하거나, 필터링 옵션을 조금 넓혀보세요.</p>
      </div>
    `;
    return;
  }
  
  state.filteredExhibitions.forEach(ex => {
    const isSaved = state.savedExhibitions.some(item => item.id === ex.id);
    const card = document.createElement('article');
    card.className = 'exhibition-card';
    card.setAttribute('data-id', ex.id);
    
    let badgeHtml = '';
    
    if (ex.priceType === 'free') {
      badgeHtml += `<span class="badge free">무료</span>`;
    } else if (ex.priceType === 'discount') {
      badgeHtml += `<span class="badge discount">할인</span>`;
    } else if (ex.priceType === 'paid') {
      badgeHtml += `<span class="badge paid">유료</span>`;
    } else {
      badgeHtml += `<span class="badge unknown">정보없음</span>`;
    }
    
    if (ex.isCultureDay) {
      badgeHtml += `<span class="badge culture-day">🎉 문화가있는날</span>`;
    }
    
    const displayPriceText = ex.priceText || (ex.priceType === 'free' ? '무료' : '금액 미상');
    
    card.innerHTML = `
      <div class="card-badges">${badgeHtml}</div>
      <h3>${escapeHtml(ex.title)}</h3>
      <p class="card-venue">🏛️ ${escapeHtml(ex.venue)} · ${escapeHtml(ex.region)} ${escapeHtml(ex.district)}</p>
      <p class="card-date">📅 ${ex.startDate} ~ ${ex.endDate}</p>
      <div class="card-price-text" title="${escapeHtml(displayPriceText)}">💰 ${escapeHtml(displayPriceText)}</div>
      <p class="card-desc">${escapeHtml(ex.description || '상세 설명 정보가 등록되어 있지 않습니다.')}</p>
      
      <div class="card-actions">
        <button class="card-btn ${isSaved ? 'saved' : 'primary'}" onclick="toggleSaveExhibition('${ex.id}')" aria-label="${escapeHtml(ex.title)} ${isSaved ? '캘린더에서 해제' : '캘린더에 저장'}">
          ${isSaved ? '❤️ 저장 해제' : '💙 내 캘린더 저장'}
        </button>
        <button class="card-btn secondary" onclick="viewExhibitionSource('${ex.id}')" aria-label="${escapeHtml(ex.title)} 출처 상세 보기">
          출처 보기
        </button>
      </div>
      
      <div class="card-source-info">
        <span>출처: ${escapeHtml(ex.sourceName || '공공데이터포털')}</span>
        <span>기준일: ${ex.lastUpdated || '2026-06-22'}</span>
      </div>
    `;
    
    elements.cardsGrid.appendChild(card);
  });
}

// -------------------------------------------------------------
// Interactive Operations (Save, Remove, View Source)
// -------------------------------------------------------------
window.toggleSaveExhibition = function(id) {
  if (!window.StorageModule) return;
  
  const target = state.exhibitions.find(item => item.id === id);
  if (!target) return;
  
  const isCurrentlySaved = state.savedExhibitions.some(item => item.id === id);
  
  if (isCurrentlySaved) {
    state.savedExhibitions = window.StorageModule.removeExhibition(id);
    showTemporaryFloatingNotice("내 주말 캘린더에서 삭제했습니다.");
  } else {
    state.savedExhibitions = window.StorageModule.saveExhibition(target);
    showTemporaryFloatingNotice("내 주말 캘린더에 저장했습니다.");
  }
  
  updateCalendarFabBadge();
  renderExhibitions();
  renderDrawerContent();
};

window.viewExhibitionSource = function(id) {
  const target = state.exhibitions.find(item => item.id === id);
  if (!target) return;
  
  if (target.sourceUrl && target.sourceUrl.trim() !== '') {
    window.open(target.sourceUrl, '_blank');
  } else {
    alert(`본 정보는 "${target.sourceName || '공공 API 데이터'}" 기준 데이터입니다.\n전시관: ${target.venue}\n주소: ${target.address || '정보 없음'}\n상세 URL이 제공되지 않아 공식 홈페이지 검색 후 방문을 권장드립니다.`);
  }
};

// -------------------------------------------------------------
// Calendar Drawer / Settings Modal Toggle Routines
// -------------------------------------------------------------
function openCalendarDrawer() {
  elements.drawerBackdrop.classList.add('open');
  elements.calendarDrawer.classList.add('open');
  elements.calendarFab.setAttribute('aria-expanded', 'true');
  renderDrawerContent();
  elements.drawerCloseBtn.focus();
}

function closeCalendarDrawer() {
  elements.drawerBackdrop.classList.remove('open');
  elements.calendarDrawer.classList.remove('open');
  elements.calendarFab.setAttribute('aria-expanded', 'false');
}

function openSettingsModal() {
  syncSettingsFromConfig();
  elements.settingsBackdrop.classList.add('open');
  elements.settingsModal.classList.add('open');
  elements.settingsToggleBtn.setAttribute('aria-expanded', 'true');
  elements.settingsCloseBtn.focus();
}

function closeSettingsModal() {
  elements.settingsBackdrop.classList.remove('open');
  elements.settingsModal.classList.remove('open');
  elements.settingsToggleBtn.setAttribute('aria-expanded', 'false');
}

// -------------------------------------------------------------
// Calendar Drawer Rendering
// -------------------------------------------------------------
function renderDrawerContent() {
  if (!window.StorageModule) return;
  
  const saved = state.savedExhibitions;
  const stats = window.StorageModule.calculateCalendarStats(saved);
  
  elements.weekendVisitCount.textContent = `${stats.weekendCount}개`;
  elements.savedFreeCount.textContent = `${stats.freeCount}개`;
  
  const formattedCost = stats.totalCost.toLocaleString();
  elements.estimatedTotalCost.textContent = stats.hasUnresolvedCosts 
    ? `${formattedCost}원 + α` 
    : `${formattedCost}원`;
  
  elements.weekendSectionCount.textContent = `${stats.weekendCount}개`;
  elements.allSectionCount.textContent = `${stats.totalCount}개`;
  
  elements.weekendSavedList.innerHTML = '';
  const weekendItems = saved.filter(ex => window.StorageModule.isExhibitionOnThisWeekend(ex));
  
  if (weekendItems.length === 0) {
    elements.weekendSavedList.innerHTML = `
      <p style="font-size: 0.875rem; color: var(--color-muted); text-align: center; padding: 1rem 0;">
        이번 주말에 진행 중인 저장된 전시가 없습니다.
      </p>
    `;
  } else {
    weekendItems.forEach(item => {
      elements.weekendSavedList.appendChild(createSavedItemNode(item));
    });
  }
  
  elements.allSavedList.innerHTML = '';
  if (saved.length === 0) {
    elements.allSavedList.innerHTML = `
      <p style="font-size: 0.875rem; color: var(--color-muted); text-align: center; padding: 1rem 0;">
        캘린더가 비어 있습니다. 전시 카드의 저장 버튼을 눌러보세요!
      </p>
    `;
  } else {
    saved.forEach(item => {
      elements.allSavedList.appendChild(createSavedItemNode(item));
    });
  }
}

function createSavedItemNode(item) {
  const node = document.createElement('div');
  node.className = 'saved-item-card';
  
  const costInfo = window.StorageModule.parseExhibitionCost(item);
  
  node.innerHTML = `
    <div class="saved-item-info">
      <h4>${escapeHtml(item.title)}</h4>
      <div class="saved-item-venue">🏛️ ${escapeHtml(item.venue)} (${escapeHtml(item.region)})</div>
      <div class="saved-item-date">📅 ${item.startDate} ~ ${item.endDate}</div>
      <div class="saved-item-price">💰 ${escapeHtml(costInfo.label)}</div>
    </div>
    <button class="saved-item-remove-btn" onclick="toggleSaveExhibition('${item.id}')" aria-label="${escapeHtml(item.title)} 제거">
      &times;
    </button>
  `;
  return node;
}

// -------------------------------------------------------------
// Small Helpers
// -------------------------------------------------------------
function updateCalendarFabBadge() {
  elements.calendarFabBadge.textContent = state.savedExhibitions.length;
}

function updateToolbarStats() {
  const total = state.filteredExhibitions.length;
  const free = state.filteredExhibitions.filter(ex => ex.priceType === 'free').length;
  elements.toolbarStatsText.textContent = `조건 만족: 총 ${total}개 · 무료 ${free}개`;
}

function updateStatusBanner() {
  if (!window.ApiModule) return;
  const config = window.ApiModule.getApiConfig();
  const activeEndpointLabel = config.endpointType === 'culture' ? '한국문화정보원' : '한국관광공사';

  if (window.apiDataSource === 'live') {
    elements.statusBanner.className = 'status-banner live';
    elements.statusBannerText.textContent = `⚡ [${activeEndpointLabel}] 실시간 공공 API 데이터 연동 성공. 최신 소식을 파악 중입니다.`;
  } else {
    elements.statusBanner.className = 'status-banner fallback';
    elements.statusBannerText.textContent = `⚠️ [${activeEndpointLabel}] 키가 비어있거나 CORS/인증 오류가 발생하여 예시 데이터를 표시 중입니다. API 설정을 확인해 주세요.`;
  }
  elements.statusBanner.style.display = 'flex';
}

function showTemporaryFloatingNotice(message) {
  const oldNotice = document.getElementById('floating-toast');
  if (oldNotice) oldNotice.remove();
  
  const toast = document.createElement('div');
  toast.id = 'floating-toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 6rem;
    right: 2rem;
    background-color: #1f2937;
    color: #ffffff;
    padding: 0.75rem 1.5rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 600;
    box-shadow: var(--shadow-lg);
    z-index: 200;
    animation: fadeIn 0.2s ease-out;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 2500);
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

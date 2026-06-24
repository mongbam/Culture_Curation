/**
 * map.js - Renders and manages the interactive SVG Grid Map of South Korea
 */

// Grid coordinates for South Korea regions
const REGION_GRID = [
  { id: 'incheon', name: '인천', col: 0, row: 0 },
  { id: 'seoul', name: '서울', col: 1, row: 0 },
  { id: 'gyeonggi', name: '경기', col: 2, row: 0 },
  { id: 'gangwon', name: '강원', col: 3, row: 0 },
  
  { id: 'chungnam', name: '충남', col: 0, row: 1 },
  { id: 'sejong', name: '세종', col: 1, row: 1 },
  { id: 'chungbuk', name: '충북', col: 2, row: 1 },
  { id: 'gyeongbuk', name: '경북', col: 3, row: 1 },
  
  { id: 'jeonbuk', name: '전북', col: 0, row: 2 },
  { id: 'daejeon', name: '대전', col: 1, row: 2 },
  { id: 'daegu', name: '대구', col: 2, row: 2 },
  { id: 'ulsan', name: '울산', col: 3, row: 2 },
  
  { id: 'jeonnam', name: '전남', col: 0, row: 3 },
  { id: 'gwangju', name: '광주', col: 1, row: 3 },
  { id: 'gyeongnam', name: '경남', col: 2, row: 3 },
  { id: 'busan', name: '부산', col: 3, row: 3 },
  
  { id: 'jeju', name: '제주', col: 1, row: 4 }
];

const CELL_SIZE = 82;
const GAP = 8;
const PADDING = 8;

/**
 * Initializes and draws the SVG map in the container
 * @param {string} containerId - Element ID to render map inside
 * @param {Function} onRegionSelect - Callback when a region is selected (returns region name)
 */
function initMap(containerId, onRegionSelect) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Map container #${containerId} not found.`);
    return;
  }
  
  // Clear previous content
  container.innerHTML = '';
  
  // Calculate size
  const maxCols = 4;
  const maxRows = 5;
  const width = maxCols * CELL_SIZE + (maxCols - 1) * GAP + PADDING * 2;
  const height = maxRows * CELL_SIZE + (maxRows - 1) * GAP + PADDING * 2;
  
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('class', 'korea-grid-svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('aria-label', '전국 지역 격자 지도. 방향키 또는 탭 키로 이동하고 엔터 키로 지역을 선택하세요.');
  
  // Render each region as a group
  REGION_GRID.forEach(reg => {
    const x = PADDING + reg.col * (CELL_SIZE + GAP);
    const y = PADDING + reg.row * (CELL_SIZE + GAP);
    
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'region-group');
    g.setAttribute('id', `region-g-${reg.id}`);
    g.setAttribute('data-region', reg.name);
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.setAttribute('aria-label', `${reg.name} 지역. 전시 정보를 불러오는 중입니다.`);
    
    // Background rect
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', CELL_SIZE);
    rect.setAttribute('height', CELL_SIZE);
    rect.setAttribute('rx', '12');
    rect.setAttribute('ry', '12');
    rect.setAttribute('class', 'region-rect');
    g.appendChild(rect);
    
    // Region Label
    const textName = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textName.setAttribute('x', x + CELL_SIZE / 2);
    textName.setAttribute('y', y + 30);
    textName.setAttribute('text-anchor', 'middle');
    textName.setAttribute('class', 'region-name');
    textName.textContent = reg.name;
    g.appendChild(textName);
    
    // Total Count
    const textTotal = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textTotal.setAttribute('x', x + CELL_SIZE / 2);
    textTotal.setAttribute('y', y + 50);
    textTotal.setAttribute('text-anchor', 'middle');
    textTotal.setAttribute('class', 'region-total');
    textTotal.textContent = '전시 -';
    g.appendChild(textTotal);
    
    // Free Count
    const textFree = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textFree.setAttribute('x', x + CELL_SIZE / 2);
    textFree.setAttribute('y', y + 66);
    textFree.setAttribute('text-anchor', 'middle');
    textFree.setAttribute('class', 'region-free');
    textFree.textContent = '무료 -';
    g.appendChild(textFree);
    
    // Event listeners
    const triggerSelection = () => {
      // Toggle active visual class on DOM
      document.querySelectorAll('.region-group').forEach(el => {
        el.classList.remove('active');
      });
      g.classList.add('active');
      
      if (onRegionSelect) {
        onRegionSelect(reg.name);
      }
    };

    g.addEventListener('click', triggerSelection);
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        triggerSelection();
      }
    });
    
    svg.appendChild(g);
  });
  
  container.appendChild(svg);
}

/**
 * Updates stats displays for each region on the map
 * @param {Array} allExhibitions - Full original list of current exhibitions (before filtering)
 * @param {string} activeRegion - Name of the currently selected region (for rendering highlight)
 */
function updateMapStats(allExhibitions, activeRegion) {
  // Clear all highlights first, then apply correct one
  document.querySelectorAll('.region-group').forEach(g => {
    const regionName = g.getAttribute('data-region');
    if (regionName === activeRegion) {
      g.classList.add('active');
    } else {
      g.classList.remove('active');
    }
    
    // Filter exhibitions for this specific region
    const regExhibitions = allExhibitions.filter(ex => ex.region === regionName);
    const totalCount = regExhibitions.length;
    const freeCount = regExhibitions.filter(ex => ex.priceType === 'free').length;
    
    // Update texts inside SVG group
    const totalTextEl = g.querySelector('.region-total');
    const freeTextEl = g.querySelector('.region-free');
    
    if (totalTextEl) {
      totalTextEl.textContent = `전시 ${totalCount}`;
    }
    if (freeTextEl) {
      freeTextEl.textContent = freeCount > 0 ? `무료 ${freeCount}` : '무료 0';
      
      // If freeCount > 0, ensure it is styled green, otherwise normal grey/muted
      if (freeCount > 0) {
        freeTextEl.classList.add('has-free');
      } else {
        freeTextEl.classList.remove('has-free');
      }
    }
    
    // Update Accessibility tags
    g.setAttribute('aria-label', `${regionName} 지역. 총 전시 ${totalCount}개 중 무료 전시 ${freeCount}개.`);
  });
}

/**
 * Highlight a specific region on the map
 * @param {string} regionName - Region name in Korean (e.g. '서울' or '전체')
 */
function highlightRegion(regionName) {
  document.querySelectorAll('.region-group').forEach(g => {
    if (g.getAttribute('data-region') === regionName) {
      g.classList.add('active');
    } else {
      g.classList.remove('active');
    }
  });
}

// Export functions to window
window.MapModule = {
  initMap,
  updateMapStats,
  highlightRegion
};

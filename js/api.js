/**
 * api.js - Handles direct public API requests, XML/JSON parsing, normalization, and fallback triggers
 * Supports KCISA, Seoul Open Data, and KOPIS API endpoints.
 */

/**
 * Clean API keys by resolving any URL double-encoding issues recursively.
 * @param {string} key 
 * @returns {string} Raw cleaned key
 */
function cleanApiKey(key) {
  if (!key) return '';
  let decoded = key.trim();
  let prev;
  try {
    do {
      prev = decoded;
      decoded = decodeURIComponent(decoded);
    } while (decoded !== prev);
  } catch (e) {}
  return decoded;
}

/**
 * Wrap a target URL with the selected CORS proxy
 * @param {string} url 
 * @param {string} proxyType 
 * @returns {string} Wrapped URL
 */
function wrapWithProxy(url, proxyType) {
  if (!proxyType || proxyType === 'none') {
    return url;
  }
  const encodedUrl = encodeURIComponent(url);
  if (proxyType === 'corsproxy') {
    return `https://corsproxy.io/?${url}`;
  } else if (proxyType === 'allorigins') {
    return `https://api.allorigins.win/raw?url=${encodedUrl}`;
  } else if (proxyType === 'thingproxy') {
    return `https://thingproxy.freeboard.io/fetch/${url}`;
  }
  return url;
}

/**
 * Resolves current API configuration from either js/config.js (window.CultureCurationConfig) or localStorage
 * @returns {Object} Current configuration state and metadata
 */
function getApiConfig() {
  const fileConfig = window.CultureCurationConfig || {};
  
  const kcisaKey = fileConfig.kcisaApiKey || localStorage.getItem('culture_curator_kcisa_key') || '';
  const seoulKey = fileConfig.seoulApiKey || localStorage.getItem('culture_curator_seoul_key') || '';
  const kopisKey = fileConfig.kopisApiKey || localStorage.getItem('culture_curator_kopis_key') || '';
  
  const endpointType = localStorage.getItem('culture_curator_endpoint_type') || fileConfig.defaultEndpointType || 'korea';
  const proxyServer = localStorage.getItem('culture_curator_proxy_server') || fileConfig.defaultProxyServer || 'corsproxy';
  
  return {
    kcisaKey: cleanApiKey(kcisaKey),
    seoulKey: cleanApiKey(seoulKey),
    kopisKey: cleanApiKey(kopisKey),
    endpointType: endpointType,
    proxyServer: proxyServer,
    isKcisaKeyFromFile: !!fileConfig.kcisaApiKey,
    isSeoulKeyFromFile: !!fileConfig.seoulApiKey,
    isKopisKeyFromFile: !!fileConfig.kopisApiKey,
    debug: fileConfig.debug || false
  };
}

/**
 * Save configuration overrides to localStorage
 * @param {Object} config - { kcisaKey, seoulKey, kopisKey, endpointType, proxyServer }
 */
function saveApiConfig({ kcisaKey, seoulKey, kopisKey, endpointType, proxyServer }) {
  if (kcisaKey !== undefined) localStorage.setItem('culture_curator_kcisa_key', cleanApiKey(kcisaKey));
  if (seoulKey !== undefined) localStorage.setItem('culture_curator_seoul_key', cleanApiKey(seoulKey));
  if (kopisKey !== undefined) localStorage.setItem('culture_curator_kopis_key', cleanApiKey(kopisKey));
  if (endpointType !== undefined) localStorage.setItem('culture_curator_endpoint_type', endpointType);
  if (proxyServer !== undefined) localStorage.setItem('culture_curator_proxy_server', proxyServer);
}

/**
 * Fetch exhibitions from the configured public portal or fallback JSON
 * @param {Object} params - Query params
 * @returns {Promise<Array>} List of normalized exhibition data
 */
async function fetchExhibitions(params = {}) {
  const config = getApiConfig();
  let currentKey = '';
  
  if (config.endpointType === 'korea') {
    currentKey = config.kcisaKey;
  } else if (config.endpointType === 'seoul') {
    currentKey = config.seoulKey;
  } else if (config.endpointType === 'kopis') {
    currentKey = config.kopisKey;
  }
  
  if (!currentKey && config.endpointType !== 'none') {
    console.warn(`No Service Key provided for endpoint [${config.endpointType}]. Loading fallback mock data.`);
    window.apiDataSource = 'fallback';
    return await getFallbackExhibitions();
  }

  try {
    let targetUrl = '';
    const today = new Date();
    const fromDate = new Date(today.getFullYear(), today.getMonth(), 1); // Start of current month
    const toDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); // End of current month
    
    const fromYmd = fromDate.toISOString().split('T')[0].replace(/-/g, '');
    const toYmd = toDate.toISOString().split('T')[0].replace(/-/g, '');

    if (config.endpointType === 'korea') {
      // KCISA (Culture Portal) Public API - period2
      // Using literal key parameter to avoid double encoding issue on public API gateways
      targetUrl = `https://apis.data.go.kr/B553457/cultureinfo/period2?serviceKey=${currentKey}&from=${fromYmd}&to=${toYmd}&pageNo=1&numOfRows=50&cpage=1&rows=50`;
    } else if (config.endpointType === 'seoul') {
      // Seoul Open Data culturalEventInfo JSON
      targetUrl = `https://openapi.seoul.go.kr:443/${currentKey}/json/culturalEventInfo/1/50/`;
    } else if (config.endpointType === 'kopis') {
      // KOPIS XML API
      targetUrl = `https://www.kopis.or.kr/openApi/restful/pblprfr?service=${currentKey}&stdate=${fromYmd}&eddate=${toYmd}&cpage=1&rows=50`;
    }

    if (config.debug) {
      console.log(`[API Debug] Request URL: ${targetUrl}`);
    }

    const wrappedUrl = wrapWithProxy(targetUrl, config.proxyServer);
    
    if (config.debug) {
      console.log(`[API Debug] Wrapped Proxy URL: ${wrappedUrl}`);
    }

    const response = await fetch(wrappedUrl);
    if (!response.ok) {
      throw new Error(`API HTTP Error: ${response.status}`);
    }

    let text = await response.text();
    
    // Parse proxy wrapper if any (e.g. AllOrigins wraps XML/JSON in contents string)
    if (text.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(text);
        if (parsed.contents) {
          text = parsed.contents;
        }
      } catch (e) {}
    }

    let normalized = [];

    // Parse XML or JSON based on content
    if (text.trim().startsWith('<')) {
      normalized = parseXmlExhibitions(text, config.endpointType);
    } else {
      const data = JSON.parse(text);
      normalized = parseJsonExhibitions(data, config.endpointType);
    }

    if (normalized && normalized.length > 0) {
      window.apiDataSource = 'live';
      return normalized;
    } else {
      throw new Error('API returned empty list or could not find items');
    }
  } catch (error) {
    console.error(`Failed to fetch from [${config.endpointType}] API. Using fallback mock data. Reason:`, error.message);
    window.apiDataSource = 'fallback';
    return await getFallbackExhibitions();
  }
}

/**
 * Fetch Culture Day Events from Public API or fallback
 * @param {Object} params 
 * @returns {Promise<Array>} List of events
 */
async function fetchCultureDayEvents(params = {}) {
  const all = await fetchExhibitions(params);
  return all.filter(item => item.isCultureDay);
}

/**
 * Fetch fallback exhibitions JSON
 * @returns {Promise<Array>}
 */
async function getFallbackExhibitions() {
  try {
    const response = await fetch('./data/fallback-exhibitions.json');
    if (!response.ok) {
      throw new Error(`Fallback HTTP Error: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to load fallback exhibitions. Returning hardcoded emergency copy.', error);
    return [
      {
        id: "emerg-01",
        title: "[긴급] 국립현대미술관 대표 소장품전",
        venue: "국립현대미술관 서울관",
        region: "서울",
        district: "종로구",
        startDate: "2026-06-01",
        endDate: "2026-08-31",
        priceType: "free",
        priceText: "무료",
        category: "미술",
        description: "한국 근현대 미술 대표작 전시",
        address: "서울시 종로구 삼청로 30",
        lat: 37.5794,
        lng: 126.9801,
        sourceName: "공공 API 데이터 기준",
        sourceUrl: "",
        isCultureDay: true,
        lastUpdated: "2026-06-22"
      }
    ];
  }
}

/**
 * Fetch detailed performance info from KOPIS XML API
 * @param {string} id - KOPIS performance ID
 * @param {string} kopisKey - Cleaned KOPIS API Key
 * @param {string} proxyServer - Proxy server type
 * @returns {Promise<Object>} Object with detailed fields
 */
async function fetchKopisDetails(id, kopisKey, proxyServer) {
  const cleanId = id.replace(/^kopis-/, '');
  const url = `https://www.kopis.or.kr/openApi/restful/pblprfr/${cleanId}?service=${kopisKey}`;
  const wrappedUrl = wrapWithProxy(url, proxyServer);
  
  const response = await fetch(wrappedUrl);
  if (!response.ok) {
    throw new Error(`KOPIS Detail HTTP error! status: ${response.status}`);
  }
  let text = await response.text();
  
  if (text.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed.contents) text = parsed.contents;
    } catch(e) {}
  }
  
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(text, 'text/xml');
  const dbNode = xmlDoc.getElementsByTagName('db')[0];
  if (!dbNode) {
    throw new Error('No db tag in KOPIS details response');
  }
  
  const getVal = (tagName, def = '') => {
    const node = dbNode.getElementsByTagName(tagName)[0];
    return node ? node.textContent || def : def;
  };
  
  const priceText = getVal('pcseguidance') || '유료 (상세내용 확인)';
  const priceType = determinePriceType(priceText);
  const address = getVal('adres') || getVal('fcltynm') || '';
  const description = getVal('sty') || '공연 상세 설명 정보는 공식 예매처 혹은 사이트 정보를 참조하세요.';
  const relateUrl = getVal('relateurl') || getVal('relate') || '';
  
  return {
    priceText,
    priceType,
    address,
    description,
    sourceUrl: relateUrl
  };
}

/**
 * Helper to clean and format dates to YYYY-MM-DD
 * @param {string} dateStr 
 * @returns {string} Formatted date
 */
function formatToYmd(dateStr) {
  if (!dateStr) return '';
  const cleaned = dateStr.replace(/[^0-9]/g, '');
  if (cleaned.length === 8) {
    return `${cleaned.substring(0, 4)}-${cleaned.substring(4, 6)}-${cleaned.substring(6, 8)}`;
  }
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch (e) {}
  return dateStr;
}

/**
 * Helper to parse region and district from address
 * @param {string} address 
 * @returns {Object} { region, district }
 */
function parseAddress(address) {
  if (!address) return { region: '서울', district: '기타' };
  
  const clean = address.trim();
  const parts = clean.split(/\s+/);
  if (parts.length === 0) return { region: '서울', district: '기타' };
  
  const rawRegion = parts[0];
  const district = parts[1] || '';
  
  let region = '서울';
  if (rawRegion.includes('서울')) region = '서울';
  else if (rawRegion.includes('경기')) region = '경기';
  else if (rawRegion.includes('인천')) region = '인천';
  else if (rawRegion.includes('부산')) region = '부산';
  else if (rawRegion.includes('대구')) region = '대구';
  else if (rawRegion.includes('광주')) region = '광주';
  else if (rawRegion.includes('대전')) region = '대전';
  else if (rawRegion.includes('울산')) region = '울산';
  else if (rawRegion.includes('세종')) region = '세종';
  else if (rawRegion.includes('강원')) region = '강원';
  else if (rawRegion.includes('충북') || rawRegion.includes('충청북도')) region = '충북';
  else if (rawRegion.includes('충남') || rawRegion.includes('충청남도')) region = '충남';
  else if (rawRegion.includes('전북') || rawRegion.includes('전라북도') || rawRegion.includes('전북특별자치도')) region = '전북';
  else if (rawRegion.includes('전남') || rawRegion.includes('전라남도')) region = '전남';
  else if (rawRegion.includes('경북') || rawRegion.includes('경상북도')) region = '경북';
  else if (rawRegion.includes('경남') || rawRegion.includes('경상남도')) region = '경남';
  else if (rawRegion.includes('제주')) region = '제주';
  
  return { region, district };
}

/**
 * Determine pricing type from raw text
 * @param {string} chargeText 
 * @returns {string} 'free' | 'discount' | 'paid' | 'unknown'
 */
function determinePriceType(chargeText) {
  if (!chargeText) return 'unknown';
  const txt = chargeText.toLowerCase();
  if (txt.includes('무료') || txt.includes('free') || txt === '0') return 'free';
  if (txt.includes('할인') || txt.includes('우대') || txt.includes('감면') || txt.includes('문화가 있는 날')) return 'discount';
  if (txt.includes('원') || txt.match(/\d+/)) return 'paid';
  return 'unknown';
}

/**
 * Parse XML string response into normalized JSON list
 * @param {string} xmlText 
 * @param {string} endpointType 
 * @returns {Array}
 */
function parseXmlExhibitions(xmlText, endpointType) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  const list = [];

  if (endpointType === 'kopis') {
    const items = xmlDoc.getElementsByTagName('db');
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const getVal = (tagName, def = '') => {
        const node = item.getElementsByTagName(tagName)[0];
        return node ? node.textContent || def : def;
      };

      const id = `kopis-${getVal('mt20id')}`;
      const title = getVal('prfnm');
      const venue = getVal('fcltynm') || '문화공연장';
      const startDate = formatToYmd(getVal('prfpdfrom'));
      const endDate = formatToYmd(getVal('prfpdto'));
      const area = getVal('area') || '서울';
      
      const { region, district } = parseAddress(area + ' ' + venue);

      list.push({
        id,
        title,
        venue,
        region,
        district,
        startDate,
        endDate,
        priceType: 'paid', // Default for KOPIS list, resolved on detail fetch
        priceText: '상세 정보 확인 필요',
        category: getVal('genr') || '공연',
        description: '상세 보기 클릭 시 실시간 공연 상세 데이터를 조회합니다.',
        address: venue,
        lat: null,
        lng: null,
        sourceName: '예술경영지원센터 KOPIS',
        sourceUrl: '',
        isCultureDay: title.includes('문화가 있는 날'),
        lastUpdated: new Date().toISOString().split('T')[0]
      });
    }
  } else {
    // KCISA XML parsing
    const items = xmlDoc.getElementsByTagName('item');
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const getVal = (tagName, def = '') => {
        const node = item.getElementsByTagName(tagName)[0];
        return node ? node.textContent || def : def;
      };

      const title = getVal('title') || getVal('eventTitle');
      const venue = getVal('place') || getVal('eventPlace') || '공공 문화시설';
      const address = getVal('address') || getVal('addr1') || '';
      const { region, district } = parseAddress(address || venue);
      
      const startDate = formatToYmd(getVal('startDate') || getVal('eventStartDate'));
      const endDate = formatToYmd(getVal('endDate') || getVal('eventEndDate'));
      
      const priceText = getVal('price') || getVal('fee') || getVal('charge') || getVal('useFee') || '무료';
      const priceType = determinePriceType(priceText);
      
      const lat = parseFloat(getVal('gpsY') || getVal('gps_y') || getVal('mapy')) || null;
      const lng = parseFloat(getVal('gpsX') || getVal('gps_x') || getVal('mapx')) || null;
      
      const isCultureDay = priceText.includes('문화가 있는 날') || title.includes('문화가 있는 날');

      list.push({
        id: `kcisa-${i}-${Date.now()}`,
        title,
        venue,
        region,
        district,
        startDate,
        endDate,
        priceType,
        priceText,
        category: getVal('realmName') || '전시/미술',
        description: getVal('subTitle') || getVal('overview') || '상세 설명 정보는 출처 페이지를 참고하세요.',
        address,
        lat,
        lng,
        sourceName: '한국문화정보원',
        sourceUrl: getVal('url') || '',
        isCultureDay,
        lastUpdated: new Date().toISOString().split('T')[0]
      });
    }
  }
  return list;
}

/**
 * Parse JSON object response into normalized list
 * @param {Object} data 
 * @param {string} endpointType 
 * @returns {Array}
 */
function parseJsonExhibitions(data, endpointType) {
  let rawItems = [];
  
  if (endpointType === 'seoul') {
    if (data.culturalEventInfo && Array.isArray(data.culturalEventInfo.row)) {
      rawItems = data.culturalEventInfo.row;
    }
    
    return rawItems.map((item, index) => {
      const title = item.TITLE || '서울시 문화행사';
      const venue = item.PLACE || item.ORG_NAME || '서울 공공시설';
      const address = item.PLACE || '';
      const district = item.GUNAME || '';
      
      const startDate = formatToYmd(item.STRTDATE);
      const endDate = formatToYmd(item.END_DATE);
      
      const priceText = item.USE_FEE || '무료';
      const priceType = determinePriceType(priceText);
      
      const lat = item.LAT ? parseFloat(item.LAT) : null;
      const lng = item.LOT ? parseFloat(item.LOT) : null;
      
      const isCultureDay = priceText.includes('문화가 있는 날') || title.includes('문화가 있는 날');

      return {
        id: `seoul-${index}-${Date.now()}`,
        title,
        venue,
        region: '서울',
        district,
        startDate,
        endDate,
        priceType,
        priceText,
        category: item.CODENAME || '전시/미술',
        description: item.PROGRAM || item.ETC_DESC || '상세 정보는 서울시 문화행사 홈페이지를 참조하십시오.',
        address,
        lat,
        lng,
        sourceName: '서울시 열린데이터광장',
        sourceUrl: item.ORG_LINK || item.HMPG_ADDR || '',
        isCultureDay,
        lastUpdated: new Date().toISOString().split('T')[0]
      };
    });
  } else {
    // KCISA JSON parsing fallback
    if (data.response && data.response.body && data.response.body.items) {
      const itemsObj = data.response.body.items;
      rawItems = Array.isArray(itemsObj.item) ? itemsObj.item : (itemsObj.item ? [itemsObj.item] : []);
    } else if (Array.isArray(data)) {
      rawItems = data;
    }

    return rawItems.map((item, index) => {
      const title = item.title || item.eventTitle || '전시 정보';
      const venue = item.place || item.eventPlace || '공공 문화시설';
      const address = item.address || item.addr1 || '';
      const { region, district } = parseAddress(address || venue);
      
      const startDate = formatToYmd(item.startDate || item.eventStartDate);
      const endDate = formatToYmd(item.endDate || item.eventEndDate);
      
      const priceText = item.price || item.fee || item.charge || item.useFee || '무료';
      const priceType = determinePriceType(priceText);
      
      const lat = item.gpsY ? parseFloat(item.gpsY) : (item.mapy ? parseFloat(item.mapy) : null);
      const lng = item.gpsX ? parseFloat(item.gpsX) : (item.mapx ? parseFloat(item.mapx) : null);
      
      const isCultureDay = priceText.includes('문화가 있는 날') || title.includes('문화가 있는 날');

      return {
        id: item.contentid ? `kcisa-${item.contentid}` : `kcisa-${index}-${Date.now()}`,
        title,
        venue,
        region,
        district,
        startDate,
        endDate,
        priceType,
        priceText,
        category: item.realmName || '전시/미술',
        description: item.subTitle || item.overview || '상세 설명 정보는 출처 페이지를 참고하세요.',
        address,
        lat,
        lng,
        sourceName: '한국문화정보원',
        sourceUrl: item.url || '',
        isCultureDay,
        lastUpdated: new Date().toISOString().split('T')[0]
      };
    });
  }
}

// Track state of current data source
window.apiDataSource = 'fallback';

// Export functions to window
window.ApiModule = {
  getApiConfig,
  saveApiConfig,
  fetchExhibitions,
  fetchCultureDayEvents,
  getFallbackExhibitions,
  fetchKopisDetails
};

/**
 * api.js - Handles direct public API requests, XML/JSON parsing, normalization, and fallback triggers
 * Supports Tour API (KTO) and Culture API (KCISA) endpoints with multiple service keys.
 */

/**
 * Resolves current API configuration from either js/config.js (window.CultureCurationConfig) or localStorage
 * @returns {Object} Current configuration state and metadata
 */
function getApiConfig() {
  const fileConfig = window.CultureCurationConfig || {};
  
  const tourKey = fileConfig.tourApiKey || localStorage.getItem('culture_curator_tour_api_key') || '';
  const cultureKey = fileConfig.cultureApiKey || localStorage.getItem('culture_curator_culture_api_key') || '';
  const endpointType = localStorage.getItem('culture_curator_endpoint_type') || fileConfig.defaultEndpointType || 'tour';
  
  return {
    tourKey: tourKey.trim(),
    cultureKey: cultureKey.trim(),
    endpointType: endpointType,
    isTourKeyFromFile: !!fileConfig.tourApiKey,
    isCultureKeyFromFile: !!fileConfig.cultureApiKey,
    debug: fileConfig.debug || false
  };
}

/**
 * Save configuration overrides to localStorage
 * @param {Object} config - { tourKey, cultureKey, endpointType }
 */
function saveApiConfig({ tourKey, cultureKey, endpointType }) {
  if (tourKey !== undefined) localStorage.setItem('culture_curator_tour_api_key', tourKey.trim());
  if (cultureKey !== undefined) localStorage.setItem('culture_curator_culture_api_key', cultureKey.trim());
  if (endpointType !== undefined) localStorage.setItem('culture_curator_endpoint_type', endpointType);
}

/**
 * Fetch exhibitions from the configured public portal or fallback JSON
 * @param {Object} params - Query params (region, isCultureDay, priceType, etc.)
 * @returns {Promise<Array>} List of normalized exhibition data
 */
async function fetchExhibitions(params = {}) {
  const config = getApiConfig();
  const currentKey = config.endpointType === 'culture' ? config.cultureKey : config.tourKey;
  
  if (!currentKey) {
    console.warn(`No Service Key provided for endpoint [${config.endpointType}]. Loading fallback mock data.`);
    window.apiDataSource = 'fallback';
    return await getFallbackExhibitions();
  }

  try {
    let targetUrl = '';
    const todayYmd = new Date().toISOString().split('T')[0].replace(/-/g, '');

    if (config.endpointType === 'culture') {
      // KCISA (Culture Portal) Public API
      const serviceUrl = 'https://api.kcisa.or.kr/openapi/service/rest/meta4/getMCST04001';
      const urlParams = new URLSearchParams({
        serviceKey: currentKey,
        numOfRows: '50',
        pageNo: '1',
        keyword: params.keyword || ''
      });
      targetUrl = `${serviceUrl}?${urlParams.toString()}`;
    } else {
      // KTO (Korea Tourism Organization) searchFestival API
      const serviceUrl = 'https://apis.data.go.kr/B551011/KorService1/searchFestival1';
      const urlParams = new URLSearchParams({
        serviceKey: currentKey,
        numOfRows: '50',
        pageNo: '1',
        MobileOS: 'ETC',
        MobileApp: 'CultureScheduler',
        _type: 'json',
        arrange: 'A',
        listYN: 'Y',
        eventStartDate: todayYmd
      });
      targetUrl = `${serviceUrl}?${urlParams.toString()}`;
    }

    if (config.debug) {
      console.log(`[API Debug] Request URL: ${targetUrl}`);
    }
    
    const response = await fetch(targetUrl);
    if (!response.ok) {
      throw new Error(`API HTTP Error: ${response.status}`);
    }

    const text = await response.text();
    let normalized = [];

    // Parse XML or JSON
    if (text.trim().startsWith('<')) {
      normalized = parseXmlExhibitions(text);
    } else {
      const data = JSON.parse(text);
      normalized = parseJsonExhibitions(data);
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
 * @returns {Array}
 */
function parseXmlExhibitions(xmlText) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  const items = xmlDoc.getElementsByTagName('item');
  const list = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const getVal = (tagName, def = '') => {
      const node = item.getElementsByTagName(tagName)[0];
      return node ? node.textContent || def : def;
    };

    const title = getVal('title') || getVal('eventTitle');
    const venue = getVal('eventPlace') || getVal('place') || '공공 문화시설';
    const address = getVal('addr1') || getVal('address') || '';
    const { region, district } = parseAddress(address);
    
    const startDate = formatToYmd(getVal('eventStartDate') || getVal('startDate'));
    const endDate = formatToYmd(getVal('eventEndDate') || getVal('endDate'));
    
    const priceText = getVal('charge') || getVal('useFee') || '무료';
    const priceType = determinePriceType(priceText);
    
    const lat = parseFloat(getVal('mapy') || getVal('lat')) || null;
    const lng = parseFloat(getVal('mapx') || getVal('lng')) || null;
    
    const isCultureDay = priceText.includes('문화가 있는 날') || title.includes('문화가 있는 날');

    list.push({
      id: `api-xml-${i}-${Date.now()}`,
      title,
      venue,
      region,
      district,
      startDate,
      endDate,
      priceType,
      priceText,
      category: '미술',
      description: getVal('subTitle') || getVal('overview') || '상세 설명 정보는 출처 페이지를 참고하세요.',
      address,
      lat,
      lng,
      sourceName: '공공데이터포털',
      sourceUrl: getVal('url') || '',
      isCultureDay,
      lastUpdated: new Date().toISOString().split('T')[0]
    });
  }
  return list;
}

/**
 * Parse JSON object response into normalized list
 * @param {Object} data 
 * @returns {Array}
 */
function parseJsonExhibitions(data) {
  let rawItems = [];
  
  if (data.response && data.response.body && data.response.body.items) {
    const itemsObj = data.response.body.items;
    rawItems = Array.isArray(itemsObj.item) ? itemsObj.item : (itemsObj.item ? [itemsObj.item] : []);
  } else if (Array.isArray(data)) {
    rawItems = data;
  }

  return rawItems.map((item, index) => {
    const title = item.title || item.eventTitle || '전시 정보';
    const venue = item.eventPlace || item.place || '공공 문화시설';
    const address = item.addr1 || item.address || '';
    const { region, district } = parseAddress(address);
    
    const startDate = formatToYmd(item.eventStartDate || item.startDate);
    const endDate = formatToYmd(item.eventEndDate || item.endDate);
    
    const priceText = item.charge || item.useFee || '무료';
    const priceType = determinePriceType(priceText);
    
    const lat = item.mapy ? parseFloat(item.mapy) : (item.lat ? parseFloat(item.lat) : null);
    const lng = item.mapx ? parseFloat(item.mapx) : (item.lng ? parseFloat(item.lng) : null);
    
    const isCultureDay = priceText.includes('문화가 있는 날') || title.includes('문화가 있는 날');

    return {
      id: item.contentid ? `api-json-${item.contentid}` : `api-json-${index}-${Date.now()}`,
      title,
      venue,
      region,
      district,
      startDate,
      endDate,
      priceType,
      priceText,
      category: '미술',
      description: item.subTitle || item.overview || '상세 설명 정보는 출처 페이지를 참고하세요.',
      address,
      lat,
      lng,
      sourceName: '공공데이터포털',
      sourceUrl: item.url || '',
      isCultureDay,
      lastUpdated: new Date().toISOString().split('T')[0]
    };
  });
}

// Track state of current data source
window.apiDataSource = 'fallback';

// Export functions to window
window.ApiModule = {
  getApiConfig,
  saveApiConfig,
  fetchExhibitions,
  fetchCultureDayEvents,
  getFallbackExhibitions
};

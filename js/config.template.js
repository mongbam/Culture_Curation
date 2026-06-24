/**
 * config.template.js - Configuration Template
 * 
 * 이 파일을 복사하여 'js/config.js' 파일을 생성한 후 발급받은 API 키들을 기입해 주세요.
 * 'js/config.js' 파일은 .gitignore에 기본 등록되어 저장소에 공유되지 않으므로 키 보안을 지킬 수 있습니다.
 */

window.CultureCurationConfig = {
  // 1. 한국관광공사 국문 관광정보 서비스(축제/행사) API 일반 인증키 (Service Key - Encoding/Decoding)
  tourApiKey: '',

  // 2. 한국문화정보원 문화포털 공공데이터 API 일반 인증키 (Service Key - Encoding/Decoding)
  cultureApiKey: '',

  // 3. 기본 호출할 공공 API 소스 지정 ('tour' 또는 'culture')
  defaultEndpointType: 'tour',

  // 4. 개발자 모드 (디버깅 정보 출력 여부)
  debug: false
};

# 김영사 미디어 모니터

김영사·주니어김영사 관련 뉴스를 수집하고 선택·편집·복사·TXT 다운로드하는 Cloudflare Workers 웹앱입니다. 로그인·예약 실행·메일 발송·도서 DB는 없습니다.

## 네이버 연결

기존 개발자센터는 2026-07-31부터 검색 API 신규 신청을 받지 않습니다. 신규 신청은 네이버 클라우드 플랫폼의 NAVER API HUB에서 진행합니다.

**비용:** 2026-10-26 확인 기준 공식 문서는 한시적 무료라고 안내하며, 유료 전환 시 사전 공지 예정입니다. 영구 무료가 아닙니다. 가입 전에 콘솔의 최신 요금과 약관을 확인하세요.

1. https://www.ncloud.com 에서 로그인 후 콘솔로 이동합니다.
2. All Services → Application Services → NAVER API HUB → Subscription에서 이용 신청 안내와 요금/약관을 확인합니다.
3. Application → Application 등록에서 검색 API를 선택하고 이름을 김영사 미디어 모니터로 등록합니다.
4. 등록한 Application의 인증 정보에서 Client ID와 Client Secret을 확인합니다. 계정 전체 Access Key가 아닌 API HUB 애플리케이션 키입니다.
5. Cloudflare → Workers & Pages → gimmyoung-news-monitor → Settings → Runtime variables and secrets → Add variable에서 각각 **Secret**으로 등록합니다.

| Name | Value |
|---|---|
| NAVER_CLIENT_ID | 발급된 Client ID |
| NAVER_CLIENT_SECRET | 발급된 Client Secret |

6. 저장·배포 후 사이트에서 기간을 선택하고 수집하기를 누릅니다. 키를 GitHub, 채팅, 브라우저 코드에 넣지 않습니다. 과거 APP_PASSWORD 및 ACCESS_* 설정은 더 이상 사용하지 않습니다.

## 배포

GitHub main 연결, 이름 gimmyoung-news-monitor, 저장소 루트 /, 빌드 npm run check, 배포 npx wrangler deploy. workers.dev 기본 주소 사용. Zero Trust와 별도 도메인은 필요하지 않습니다. ratelimits 바인딩은 wrangler.jsonc로 함께 배포됩니다. Wrangler 4.36.0 이상이 필요합니다.

## 수집 제한과 캐시

- 수집 POST만 IP별 분당 약 6회, 전체 분당 약 20회 제한합니다. 사무실처럼 공인 IP를 공유하면 IP별 제한도 공유합니다.
- Cloudflare Rate Limiting API는 지역별 근사 제한입니다. 전 세계 합산 일일 한도나 공격 차단을 보장하지 않습니다.
- 제한 설정이 없거나 확인할 수 없으면 수집만 503으로 중단합니다. 화면은 열립니다.
- 성공한 동일 기간 결과를 Cloudflare Cache API로 5분간 재사용합니다. 다시 수집도 이 기간에는 캐시를 사용하며 화면에 알립니다. 수정/선택한 내용은 서버 캐시에 저장하지 않습니다.
- 캐시는 지역별이고 조기에 사라질 수 있습니다. 동시 최초 요청은 중복 수집할 수 있습니다. 실패나 일부 수집은 캐시하지 않습니다.
- 날짜는 한국시간 기준 최대 31일이며 검색어는 서버에 고정되어 있습니다. 키는 서버에서만 사용합니다.
- 검색 제외 헤더와 robots.txt를 유지합니다. 이들은 접근 차단 장치가 아니며, URL을 아는 누구나 화면과 결과를 사용할 수 있습니다.

## 기능과 현재 한계

- 김영사 / 주니어김영사 / 주니어 김영사 뉴스 검색, 날짜 필터, 동일 URL 중복 제거, 출판사별 분류
- 기사 선택, 제목·출처 편집, 복사, UTF-8 BOM TXT 다운로드
- 명시적으로 표시된 가상 화면 예시 제공
- 네이버 API의 제공 시간 기준 필터. 원문 최초 발행일과 다를 수 있습니다.
- 제목·검색 설명 기반 분류이며 본문은 읽지 않습니다. 불확실한 항목은 확인 필요로 표시합니다.
- 매체명 필드가 없어 출처 도메인을 표시하며 직접 수정할 수 있습니다.
- 최신순 검색 최대 1,000건. 상한에 닿으면 일부 수집으로 표시합니다.
- **기관 공고 자동 수집기는 아직 미구현**입니다. 세 기관 게시판 링크와 연결 대기 상태를 보여줍니다.
- 결과와 편집은 브라우저 메모리에서만 유지되며 새로고침하면 사라집니다.
- 실제 Naver 연결은 사용자 키 등록 후 확인해야 합니다.

## 로컬 점검

Node.js 22 이상: npm install → npm test → npm run check. npm run preview는 loopback의 화면 전용 미리보기이며 실제 수집하지 않습니다. npm run dev는 로컬 Worker 테스트용입니다.

## 참고

- https://api.ncloud-docs.com/docs/naver-api-hub-search-news
- https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/

- 이관 안내: https://guide.ncloud-docs.com/docs/apihub-migration
- 한시적 무료 안내: https://guide.ncloud-docs.com/docs/apihub-overview

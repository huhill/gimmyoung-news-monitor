# 김영사 미디어 모니터

김영사·비채·주니어김영사 뉴스를 수집하고 원문 날짜와 본문 관련성을 자동 확인한 결과만 표시하는 Cloudflare Workers 웹앱입니다. 도서 DB·수동 검수·예약 실행·메일 발송은 없습니다.

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
- 날짜는 한국시간 기준 최대 31일입니다. 브랜드 검색어 4개를 조회합니다. 키는 서버에서만 사용합니다.
- 검색 제외 헤더와 robots.txt를 유지합니다. 이들은 접근 차단 장치가 아니며, URL을 아는 누구나 화면과 결과를 사용할 수 있습니다.

## 기능과 현재 한계 (v0.4)

- 김영사 / 비채 / 주니어김영사 / 주니어 김영사 검색. 검색어당 최신 500건까지, 한국시간 최대 31일
- 중복 제거 후 최신순 최대 24건 원문을 4개씩 병렬 확인합니다. 조회 예산을 넘긴 기사는 미확인 건수로 표시하며 결과에 포함하지 않습니다.
- 승인 조건: 원문 최초 발행일 메타정보 일치 + 선택 기간 포함 + 기사 본문에서 출판사 관련 언급 확인
- 수정일만 있는 원문, 날짜 충돌, 본문 식별 실패, 접근 차단은 제외합니다. 기간 밖 기사는 별도 집계합니다.
- articleBody 구조화 데이터 또는 식별 가능한 본문 영역만 확인합니다. 메뉴·추천 영역·검색 설명은 관련성 증거로 사용하지 않습니다.
- 비채는 출판사·펴냄·출간 등 출판 맥락이 함께 확인되어야 승인합니다. 모든 표기를 인식하지 못할 수 있습니다.
- 책 제목만 등장하고 출판사명이 없는 기사는 놓칠 수 있습니다. 최초 후보 필터는 네이버 제공 날짜이므로 원문 날짜가 달라지는 일부 기사는 누락될 수 있습니다.
- 자동 확인된 기사만 응답·화면·보고서에 포함. 수동 확인 버튼·DB·추가 검색어·도서 분류·수동 공고 추가를 제거했습니다.
- 브랜드 순서 김영사 → 비채 → 주니어김영사, 날짜 오름차순 TXT. 여러 브랜드를 언급한 기사는 해당 브랜드 각각에 표시
- 이전 버전 브라우저 도서 목록과 수동 승인 초안을 읽거나 자동 승인으로 승격하지 않습니다. 기존 로컬 데이터는 삭제하지 않습니다.
- 기관 공고는 진흥원 3개 게시판 최근 각 6건의 공식 상세 작성일이 확인된 것만 표시. 전체 수집이 아니며 배포 환경에서 HTTP 400 차단이 확인된 상태입니다. 협회·출판인회의도 접근 제한 상태로 안내합니다.
- 자동 판별은 전수조사·무오류를 보장하지 않습니다. 실패·불확실·한도 초과 건수를 함께 표시합니다.
- 원문에서 매체명 메타정보를 읽으며 알려진 매체 매핑을 우선 사용합니다. 추가 AI 서비스는 사용하지 않습니다.

## 로컬 점검

Node.js 22 이상: npm install → npm test → npm run check. npm run preview는 loopback의 화면 전용 미리보기이며 실제 수집하지 않습니다. npm run dev는 로컬 Worker 테스트용입니다.

## 참고

- https://api.ncloud-docs.com/docs/naver-api-hub-search-news
- https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/

- 이관 안내: https://guide.ncloud-docs.com/docs/apihub-migration
- 한시적 무료 안내: https://guide.ncloud-docs.com/docs/apihub-overview

## 자동 배포 연결 복구

Cloudflare Builds에 Git 계정 연결 끊김 또는 API token unavailable 경고가 있으면 저장소 접근 권한과 배포 토큰을 복구해야 합니다. 복구 후 main의 새 커밋으로 최신 코드 빌드를 실행하고 Deployments에서 새 Build의 성공 여부를 확인하세요. Runtime Secret 변경만으로는 GitHub 최신 코드를 가져오지 않습니다.

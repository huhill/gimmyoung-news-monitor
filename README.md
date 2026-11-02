# 김영사 미디어 모니터

김영사·비채·주니어김영사 관련 뉴스를 수집하고 검수·복사·TXT 다운로드하는 Cloudflare Workers 웹앱입니다. 로그인·예약 실행·메일 발송은 없습니다. 도서 목록과 초안은 사용자의 브라우저에 저장됩니다.

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
- 날짜는 한국시간 기준 최대 31일입니다. 브랜드 검색어 4개와 사용자가 선택한 추가 검색어 최대 3개를 조회합니다. 키는 서버에서만 사용합니다. 추가 검색어별로 캐시를 구분합니다.
- 검색 제외 헤더와 robots.txt를 유지합니다. 이들은 접근 차단 장치가 아니며, URL을 아는 누구나 화면과 결과를 사용할 수 있습니다.

## 기능과 현재 한계 (2026-11-02)

- 김영사 / 비채 / 주니어김영사 / 주니어 김영사 뉴스 검색, 날짜 필터, 동일 URL 중복 제거
- 검수 상태·브랜드·도서 분류·출처·최초 발행일 수정, 확인 완료 항목만 복사·UTF-8 BOM TXT 다운로드
- 브랜드 순서 김영사 → 비채 → 주니어김영사, 도서별 묶기, 발행일 오름차순. 한 기사에 여러 도서를 지정하면 각 도서 아래 표시
- CSV/TSV 불러오기 또는 엑셀 셀 복사·붙여넣기. `.xlsx` 파일 직접 업로드는 지원하지 않으므로 CSV로 저장하거나 셀을 복사합니다.
- 첫 행 필수: 도서명, 브랜드(또는 출판사). 선택: 저자, ISBN. 정확한 브랜드는 김영사·비채·주니어김영사이며 다른 브랜드 행은 건너뜁니다.
- ISBN 또는 브랜드+도서명으로 기존 목록을 갱신·합치며, 없는 도서는 유지. 로컬 저장이므로 팀원/다른 PC와 자동 동기화하지 않습니다. CSV 백업을 보관하세요.
- 도서 목록은 서버에 전송하지 않습니다. 선택한 추가 검색어만 Cloudflare와 네이버로 전달됩니다. 도서 전체 검색이 아닌 선택 검색입니다.
- 기사 제목·검색 설명과 도서명을 대조하여 분류 후보 제안. 짧거나 동명이 도서는 오인 가능하므로 검수 필요
- 명시적으로 표시된 가상 화면 예시 제공
- 최초 수집은 네이버 API의 제공 시간 기준 필터입니다. 원문 날짜만 기간 안에 있고 API 날짜가 밖인 기사는 누락될 수 있습니다.
- 원문 날짜 자동 확인 버튼은 수집한 URL에만 유효한 1시간 서명을 사용합니다. 최초 발행 메타정보만 사용하며 수정일은 사용하지 않습니다. 메타정보 충돌·접근 차단·리디렉션은 직접 확인 대상으로 남깁니다.
- 제목·검색 설명 기반 분류이며 본문은 읽지 않습니다. 불확실한 항목은 확인 필요로 표시합니다.
- 알려진 매체명 매핑 + 미등록 매체의 사이트 이름 메타정보 확인 (수집당 최대 6곳). 실패하면 도메인 유지
- 최신순 검색어당 최대 500건. 상한에 닿으면 일부 수집으로 표시합니다. 한 요청 외부 조회 수를 제한하기 위한 상한입니다.
- 진흥원 사업공고·KPIPA 소식·보도자료 각 최근 6건 상세 페이지를 조회하는 제한적 수집기. 전체 기간 전수 확인이 아니므로 항상 일부 확인 또는 확인 불가로 표시합니다. 접근 위치에 따라 차단될 수 있습니다.
- 협회 보안 확인, 출판인회의 접근 오류를 우회하지 않습니다. 공식 링크에서 직접 확인한 공고를 입력할 수 있습니다.
- 공고는 상세 페이지 작성일을 사용하고 직접 입력한 공고도 검수 전까지 보고서에서 제외됩니다.
- 도서 목록·기사·공고 초안은 localStorage에 보관됩니다. 브라우저 데이터 삭제 시 사라집니다. API 비밀키는 저장하지 않습니다.
- 실제 Naver 연결은 사용자 키 등록 후 확인해야 합니다.

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

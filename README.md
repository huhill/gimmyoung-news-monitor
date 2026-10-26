# 김영사 미디어 모니터

팀 내부용 Cloudflare Workers 웹앱 베이스입니다. 예약 실행, 이메일 발송, 도서·저자 DB 없이 필요할 때 수집합니다.

## 구현 범위

- 한국시간 기준 기간 선택 (기본 지난주, 최대 31일), 수집 / 다시 수집
- 네이버 뉴스 API: 김영사, 주니어김영사, 주니어 김영사 검색, 날짜 필터, 동일 URL 중복 제거
- 김영사 / 주니어김영사 / 공통 / 분류 확인 필요 분류
- 항목 선택, 제목·출처 수정, 복사, UTF-8 BOM TXT 다운로드
- 예시 보기: 명시적으로 표시된 가상 데이터이며 실제 뉴스가 아닙니다.
- 공용 비밀번호 로그인 · 서명된 8시간 쿠키 · 로그아웃
- 전체 화면/정적 파일/API 인증, noindex, robots.txt, no-store, CSP

## 아직 연결되지 않은 부분

- 기관 공고 자동 수집기는 아직 없습니다. 세 기관 게시판 링크와 상태를 표시합니다. 화면과 TXT에도 이 사실을 표시하며, 수집 실패를 0건으로 숨기지 않습니다.
- 네이버 인증키가 없어 실 API 연동 검증은 수행하지 않았습니다. 검색 API의 제공 시간으로 기간을 필터링하므로 원문 최초 발행일과 다를 수 있습니다.
- 제목·검색 설명과 검색어 기준 분류이며 기사 본문을 읽지 않습니다. 불확실한 기사는 확인 필요로 표시합니다.
- 네이버 API에는 매체명 필드가 없어 출처는 원문 도메인으로 표시하며 사용자가 수정할 수 있습니다.
- 최신순 최대 1,000개 검색 결과를 확인합니다. 한도에 도달하면 일부 수집으로 표시합니다. 오래된 기간의 완전한 검색은 보장하지 않습니다.
- 결과는 현재 브라우저 메모리에만 존재합니다. 새로고침/재수집 시 편집이 사라지며, 영구 저장이나 공유 DB는 없습니다.

## 로컬 확인

Node.js 22 이상을 사용합니다.

```sh
npm install
npm test
npm run check
npm run preview
```

`http://127.0.0.1:4173`은 화면 전용 미리보기입니다. 실제 검색이나 인증 우회 기능이 없고 loopback에만 바인딩됩니다. `npm run dev`의 Worker는 인증 설정이 없으면 차단되는 것이 정상입니다.

## Cloudflare 배포 및 비밀번호 설정

GitHub 저장소를 Worker에 연결합니다. 이름은 gimmyoung-news-monitor, 빌드 명령은 npm run check, 배포 명령은 npx wrangler deploy입니다. 기본 workers.dev 주소를 사용하며 별도 도메인이나 Zero Trust 가입은 필요하지 않습니다.

Worker → Settings → Runtime variables and secrets → Add variable에서 Type을 Secret으로 선택합니다.

| 이름 | 값 |
|---|---|
| APP_PASSWORD | 팀이 공유할 12자 이상 임의 비밀번호 또는 긴 암호문구 |
| NAVER_CLIENT_ID | 네이버 검색 API Client ID |
| NAVER_CLIENT_SECRET | 네이버 검색 API Client Secret |

APP_PASSWORD를 저장·배포한 뒤 사이트에서 비밀번호를 입력하면 됩니다. 키 등록 전에도 화면은 사용할 수 있지만 실제 뉴스 수집에는 네이버 인증키가 필요합니다. 비밀번호는 GitHub나 채팅에 쓰지 마세요. 이전 ACCESS_TEAM_DOMAIN / ACCESS_AUD / ALLOWED_EMAILS는 더 이상 사용하지 않습니다.

화면/수집 API는 로그인해야 사용할 수 있습니다. 로그인 화면·스타일·robots.txt만 공개됩니다. 비밀번호가 없거나 12자 미만이면 닫힌 상태로 유지됩니다. 로그인은 8시간 유지되며 HttpOnly/Secure/SameSite 쿠키를 사용합니다. 비밀번호 변경 시 이전 세션이 무효화됩니다. 개별 로그아웃은 현재 브라우저 쿠키를 삭제하며, 이미 탈취된 쿠키 자체를 취소하려면 공용 비밀번호를 변경해야 합니다.

로그인 실패 시 IP별 5분/10회 제한이 있습니다. Worker 실행 인스턴스 메모리 기반의 보조 제한이므로 전역·분산 공격 방어를 보장하지 않습니다. 추측하기 어려운 비밀번호를 사용하세요. noindex와 robots.txt는 검색 제외 안내이며, 접근 차단은 서버 로그인 검증이 담당합니다.

## 다음 개발 단계

기관별 접근 방식·이용 조건을 확인해 게시판 전용 수집기를 연결하고 실제 HTML로 날짜/페이지 넘김/구조 변경을 검증합니다. 보안 확인 화면을 우회하지 않습니다. 필요해질 때만 결과 저장을 추가합니다.

## 공식 참고 문서

- [Cloudflare GitHub 연동](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/)
- [정적 파일보다 Worker 먼저 실행](https://developers.cloudflare.com/workers/static-assets/binding/)
- [Access JWT 검증](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [네이버 뉴스 검색 API](https://developers.naver.com/docs/serviceapi/search/news/news.md)

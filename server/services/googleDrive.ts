/**
 * Google Drive API 서비스 [ID: 600001]
 * - Google Drive 파일 삭제 기능
 * - GOOGLE_SERVICE_ACCOUNT_JSON 환경변수 사용
 */

interface DriveFile {
  id: string;
  name: string;
  mimeType?: string;
  size?: number;
  webViewLink?: string;
  createdTime?: string;
}

/**
 * Google Drive API 인증 토큰 발급
 */
async function getAccessToken(): Promise<string> {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON 환경변수가 설정되지 않았습니다.");
  }

  const serviceAccount = JSON.parse(serviceAccountJson);

  // JWT 생성 (Google OAuth2)
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  // jose 라이브러리로 JWT 서명
  const { SignJWT, importPKCS8 } = await import("jose");
  const privateKey = await importPKCS8(serviceAccount.private_key, "RS256");
  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256" })
    .sign(privateKey);

  // 토큰 교환
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Google OAuth 토큰 발급 실패: ${err}`);
  }

  const tokenData = await tokenRes.json() as { access_token: string };
  return tokenData.access_token;
}

/**
 * Google Drive 파일 삭제
 */
export async function deleteDriveFile(fileId: string): Promise<boolean> {
  try {
    const accessToken = await getAccessToken();
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // 204 No Content = 성공
    return res.status === 204;
  } catch (err) {
    console.error("[GoogleDrive] 파일 삭제 실패:", err);
    return false;
  }
}

/**
 * Google Drive 파일 정보 조회
 */
export async function getDriveFileInfo(fileId: string): Promise<DriveFile | null> {
  try {
    const accessToken = await getAccessToken();
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,webViewLink,createdTime`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return null;
    return await res.json() as DriveFile;
  } catch {
    return null;
  }
}

/**
 * Google Drive 폴더 내 파일 목록 조회
 */
export async function listDriveFiles(folderId: string, pageToken?: string): Promise<{
  files: DriveFile[];
  nextPageToken?: string;
}> {
  try {
    const accessToken = await getAccessToken();
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "nextPageToken,files(id,name,mimeType,size,webViewLink,createdTime)",
      pageSize: "100",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return { files: [] };
    const data = await res.json() as { files: DriveFile[]; nextPageToken?: string };
    return { files: data.files || [], nextPageToken: data.nextPageToken };
  } catch {
    return { files: [] };
  }
}

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/ef6ecf83-a3d7-412d-80da-47add063882c

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## 報價編輯

- 修改欄位、器材或檔期費用後，停止輸入約 1 秒會自動儲存至伺服器，不會離開編輯頁。
- 頁首顯示等待儲存、儲存中或已自動儲存。儲存失敗時保留編輯內容，可按「重試儲存」；尚未儲存前重新整理或關閉頁面會提示確認，請勿忽略提示以免遺失變更。
- 返回箭頭與「儲存並返回」都會等待最新修改儲存成功，失敗時留在編輯頁。
- 器材名稱旁的上下箭頭可調整同一分類內的順序；第一筆不能上移、最後一筆不能下移。排序會自動儲存，報價單與器材單沿用此順序，不改變分類。
- 報價單的檔期費用只顯示名稱與金額，不顯示計費百分比；一般版、附件摘要及 PDF 一致。編輯器仍保留百分比設定，金額計算不變。

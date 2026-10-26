# S-Generator UI — スマホ基本版
GitHub Pagesで公開する画面。処理用の非公開 singing-generator と分離しています。
`npm test` で基本ロジックを確認。ビルド不要。Pagesはmainルートを公開。

公開するのは画面コードのみです。秘密鍵・個人の音声・プロジェクト情報をこのリポジトリに置かないこと。
要件と設計の正本は処理用リポジトリのdocs/です。

## 初回
処理リポジトリへのContents/Actions read-writeに限定したFine-grained PATを入力。
Cloudinary Secretsは処理用リポジトリにのみ登録します。
音声なしの端末内操作デモは接続不要、クラウド合成音テストはGitHubのみ必要。

## 制限
実声品質・iPhone実機・Cloudinary実接続は素材/Secrets未提供のため未承認。
音声はmono24kHzの実験エンジン。時間補正、フレーズ編集、複数テイクは次段階。
非公開署名URLは端末のRSAキーで復号、期限切れ時は履歴から再取得。
入力の自動削除は未実装。画面の出力削除ではCloudinary出力のみ削除し、入力とActions artifactは残ります。

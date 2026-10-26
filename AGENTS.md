# 開発時の参照
処理用 singing-generator の docs/REQUIREMENTS.md, ARCHITECTURE.md, ROADMAP.md, VALIDATION.md, PHASE2.md を読んでから開発。
2026-10-26ユーザー指示で実声評価前に第2段階を先行。音質承認済みとは表示しない。
公開リポジトリに秘密情報・個人音源を置かない。トークンはヘッダーのみ、保存は明示選択。
外部スクリプトを増やさず、入力やGitHubの曲名はtextContentで表示する。

第3段階の正本は処理用docs/PHASE3.md。音程補正なしと全体DSPの適用範囲を混同しない。旧版の設定と素材を保ち、修正版は別要求IDへ出力。

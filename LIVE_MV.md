# AIライブMV試験版

「処理・試聴」で保存済みの実声出力を選び、「AIライブMV」で黒フードまたは本人写真を選択する。本人版は写真を非公開Cloudinaryへ登録してから実行する。まずCPU配信試験1秒を行い、GPU生成は短尺から確認する。完成MP4の非公開試聴リンクは15分有効。

処理リポジトリのActions Secret `KAGGLE_API_TOKEN` が必要。GPU推論、本人の顔の一致、口元同期、77秒の品質は未検証。音声加工は従来どおり使える。処理側のデータ契約、保存・削除、検証順は `MasayukiYamakura/singing-generator/docs/LIVE_MV.md` を参照。

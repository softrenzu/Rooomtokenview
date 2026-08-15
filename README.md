# Rooom Token View

GPT Work、通常の ChatGPT、Claude のプラン使用量を、Chrome / Edge の拡張アイコンからすぐ確認するための軽量ブラウザ拡張です。

## v0.2.0 の主な変更

- GPT Work の残り使用量を最上段に表示
- GPT Work / Codex の公式 Usage Dashboard から 5 時間枠・週間枠・リセット情報を取得
- 追加クレジット残高が画面にある場合は表示
- 拡張アイコンのバッジは GPT Work の実質的な残り率を最優先表示
- Work の同期ボタンを追加
- 日本語 / 英語の Usage 表示に対応するパーサーを追加

## 何が見えるか

| 項目 | 表示内容 | 取得方法 |
|---|---|---|
| GPT Work | 5時間枠の残り%、週間枠の残り%、リセット情報、追加クレジット | ChatGPT の Codex Usage Dashboard |
| 通常ChatGPT | 直近の送信数、参考上限に対する残り件数・残り率 | ブラウザ内の送信履歴 + 画面上の制限表示 |
| Claude | 5時間セッションの残り%、週間残り%、リセット情報 | Claude Settings > Usage |
| 拡張バッジ | GPT Work の5時間枠と週間枠のうち低い方 | GPT Work同期値を優先 |

## GPT Work の残量について

ChatGPT Work は Work 専用の固定トークン残高ではありません。Work は Codex などと同じ agentic usage / credit pool を共有します。

そのため本拡張では、ChatGPT の公式 Usage Dashboard に表示される次の値を「GPT Workで使える残り使用量」として表示します。

- 5時間枠の残り率
- 週間枠の残り率
- 各枠のリセット時刻
- 追加クレジット残高（表示されている場合）

同期先の標準URL:

`https://chatgpt.com/codex/settings/usage`

5時間枠と週間枠は独立した制限なので、実用上は低い方を残り余力の目安としています。

## インストール

1. このリポジトリをダウンロードまたは clone します。
2. Chrome で `chrome://extensions`、Edge で `edge://extensions` を開きます。
3. 「デベロッパーモード」を有効にします。
4. 「パッケージ化されていない拡張機能を読み込む」を押します。
5. このリポジトリのルートフォルダを選択します。
6. Rooom Token View をツールバーに固定します。

既に v0.1.0 を読み込んでいる場合は、GitHub から最新版へ更新したあと `chrome://extensions` の「更新」または Rooom Token View カードの再読み込みボタンを押してください。

## GPT Work の同期

拡張ポップアップの GPT Work 欄で「同期」を押すと、Usage Dashboard を非アクティブタブで開きます。ログイン済みの ChatGPT セッション上に表示された使用量を読み取り、取得後は同期用タブを閉じます。

「Work Usage」ボタンを押すと Usage Dashboard を通常のタブで直接開けます。

## Claude の同期

Claude 欄の「同期」を押すと `https://claude.ai/settings/usage` を非アクティブタブで開き、表示された Usage を読み取ります。取得後は同期用タブを閉じます。

## 通常ChatGPTの精度について

通常ChatGPTの個人プランには、固定トークン残高を返す公開APIがありません。またプランやモデルによって上限が変わるため、通常ChatGPTの表示は「残り目安」です。

この拡張は ChatGPT 上で送信操作をローカル記録します。拡張導入前の送信履歴や、別ブラウザ・スマートフォンからの利用は自動では反映されません。

GPT Workについては送信回数から推定せず、公式Usage Dashboardに表示された残り率を読み取ります。

## プライバシー

- API キー不要
- ChatGPT / Claude のパスワードを取得しません
- 認証 Cookie を外部へ送信しません
- 会話本文を外部へ送信しません
- 計測値は `chrome.storage.local` に保存します
- 外部サーバーは使用しません

## 開発

依存パッケージなしで動作します。パーサーのテストのみ Node.js を使用します。

```bash
npm test
```

## 現在の制約

- GPT Work の値は Work 単独使用量ではなく、Codex 等と共有する agentic usage 枠です。
- Usage Dashboard の画面構成が変わった場合、読み取りルールの調整が必要になることがあります。
- 通常ChatGPTの正確な残トークン数は表示できません。
- 通常ChatGPTのローカル送信カウンターは端末間同期しません。

## License

個人・非商用利用は無償です。法人利用、商用利用、本番業務利用、再販売、SaaS 組み込みは別途商用ライセンスが必要です。詳細は `LICENSE` を参照してください。

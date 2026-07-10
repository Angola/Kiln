# Kiln ユースケース集

「で、これ結局どう使うの？」に答えるための具体例。抽象的な設計思想は
[`../DESIGN.md`](../DESIGN.md) に、全体像は [`../README.md`](../README.md) に
あります。ここには **「あなたが何を打って、何が起きて、何が見えるか」** だけを書きます。

## 共通の型

どのユースケースも、結局この3ステップです。

```
① エージェントに一言       「◯◯を Kiln に入れて」
② エージェントが push       (データ収集 → 正規化 → push_dataset)
③ あなたが URL を開く       ブラウザでフィルタ / 検索 / ソート / グラフを操作
```

覚えることは実質これだけ。

| やりたいこと | モード | エージェントへの言い方 |
| --- | --- | --- |
| 調査結果・ランキング（毎回入れ替え） | `snapshot` | 「Kiln に入れて」 |
| ログ・メトリクス（毎日積む） | `append` | 「◯◯ に append、キーは △△」 |
| 入れる前に確認したい | — | 「validate して」 |

役割分担も一枚で：

```
       入力側                        出力側
─────────────────         ─────────────────
エージェント → MCP           あなた → ブラウザ UI
(push_dataset)              (フィルタ / 検索 / 詳細を操作)
```

人間はデータを **入れない**（アップロード UI は無い / Phase 3 まで）。
入れるのはエージェント。人間は **見る・探す** だけ。

---

## ① 好き嫌いコメントを集計して眺める（snapshot）

**場面**: ネットの「好き嫌いが分かれる食べ物」スレを集めて傾向を見たい。

**あなたがやること** — Claude Code にこう言うだけ:

> このスレ群からコメント集めて、Kiln に入れて

**中で起きること**:

1. エージェントがスレを読み、各コメントを正規化して
   [`sukikirai-comments.json`](./sukikirai-comments.json) の形にする
2. `push_dataset` を呼ぶ
3. Kiln が自動判定:
   - `sentiment` → カテゴリ（select フィルタ）
   - `postedAt` → 時間軸
   - `upvotes` → 数値（range フィルタ + グラフ対象）
   - `body` → 長文（全文検索）
   - `sourceUrl` → リンク列
4. URL が返る

**あなたが見る画面** (`http://localhost:3000/d/sukikirai-comments`):

- `sentiment` で **like / dislike / neutral を絞り込み**
- `body` を「石鹸」で **全文検索** して否定派の声だけ拾う
- `upvotes` で **降順ソート** → パイナップルピザ否定(134) が一番上に
- **sentiment 別の分布（円グラフ）** が自動で出ている

UI 設計は 1 行もしていない。データを渡しただけで管理画面が立つ。

---

## ② トレードログを日次で積む（append）

**場面**: 毎日のトレード結果を溜めて損益推移を見たい。**毎日増える**のがポイント。

**初回** — エージェントに:

> 今日のトレード、Kiln に append で入れて。重複キーは `tradeId`

エージェントが投げる spec:

```json
{
  "version": "1.0", "kind": "dataset", "entity": "trade",
  "mode": "append", "upsertKey": "tradeId",
  "source": { "type": "mcp", "name": "zankyo-trades" },
  "records": [
    { "tradeId": "t-0612-01", "symbol": "7203", "side": "buy",
      "pnl": 12400, "closedAt": "2026-06-12T05:00:00Z" }
  ]
}
```

Kiln 判定: `pnl` → metric、`closedAt` → 時間軸、`side` / `symbol` → カテゴリ。
**append × 時間軸 × metric なので「pnl over time（折れ線）」が自動生成**される
（理由付き: "append dataset with a time field and a metric — track the trend"）。

**2 日目以降** — 同じ dataset 名に追記するだけ:

> 今日の分を zankyo-trades に append

`upsertKey: tradeId` で **重複は自動排除、同じ URL に行が積み上がる**。画面を
再読み込みすれば損益折れ線が伸びている。列が途中で増えても（例: `strategy` を
足す）既存の型を壊さずマージされる（§4.2）。

**あなたが見る画面**:

- **期間フィルタ**で「今週だけ」に絞る
- `side` で買い / 売りを切り替え
- 損益の折れ線で調子を一目確認

「毎日 1 行言うだけで、育っていくダッシュボード」。これが append の真骨頂。

---

## ③ 配信アナリティクスを接続（append）

**場面**: 配信の視聴数・チャット数を日次で溜めて推移を見る。② とほぼ同型。

> 配信の今日のメトリクス、streaming-analytics に append。キーは `date`

`viewers` / `chatCount` → metric、`date` → 時間軸。**視聴数の折れ線**が自動で立つ。
② と同じ運用パターンで、対象データが違うだけ。一度この型を覚えれば、
**あらゆる「日次で増える数値」がこの手順に乗る**。

---

## ④ 投入前に確認だけする（dry-run）

**場面**: 大量データを入れる前に「Kiln がどう解釈するか」だけ見たい。

> このデータ、`validate_dataset_spec` で確認して。まだ入れないで

`push` せずに **推定 schema + 各列の統計（distinct 数・欠損・サンプル値）** が返る。
「あれ、`author` が category じゃなく string 判定されてる」みたいな **誤判定を
投入前に発見** できる。気になったら spec にヒントを足して本番 push（AI ヒントが
推定に勝つ、§4.3）:

```json
{ "schema": { "author": { "type": "category", "role": "category" } } }
```

---

## MCP ツール早見表

| ツール | 役割 |
| --- | --- |
| `push_dataset` | DatasetSpec を投入（snapshot=全置換 / append=upsert）→ URL を返す |
| `append_records` | 既存 dataset にレコード追記 / upsert |
| `validate_dataset_spec` | dry-run: 投入せず検証 + 推定 schema プレビュー |
| `list_datasets` | dataset 一覧 |
| `get_dataset` | メタ情報 + 推定 schema 取得 |

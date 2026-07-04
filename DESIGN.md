# Kiln 設計書 v2

## 0. v1からの変更点

- **名称:** AI Data Runtime → Formwork → **Kiln**
- **入口の反転:**
  - v1: 人間がCSV/JSONをアップロードする → MCPは最後
  - v2: AIがMCPで投入する → アップロードUIは最後
- **責務の純化:**
  - v1: MCPに `collect_from_url` 等の収集ツールがあった
  - v2: Kilnは収集しない。受け取るだけ。収集はAI側の責務
- **DatasetSpecの拡張:** `mode` (snapshot / append) を追加。継続的に増えるデータ(トレードログ等)に対応
- **成功基準の明文化:** 各Phaseに手元の実データセットによる合格条件を設定

## 1. 概要

Kiln は、AIが収集・正規化した構造化データを受け取り、管理画面・テーブル・フィルタ・グラフ・詳細画面を自動生成するランタイムである。

陶芸の窯(kiln)と同じく、投入された素材(生の構造化データ)は窯を通ることで完成品(管理画面)になる。形を与えるのは窯の側であり、窯自体は作品ではなくインフラである。

> 名称の衝突状況(2026-07確認): Kiln(ステーキング企業)、旧 Fog Creek Kiln(コードレビュー、終了済)が同名だがいずれも別分野。npm/ドメイン/商標は確定前に要再確認。

目的はAIにUIを作らせることではない。AIの役割はデータ収集と正規化に限定し、UI生成・フィルタ設計・グラフ選定・表示最適化はシステム側で行う。

## 2. 基本思想

**AIの責務:**
- データを集める(Kilnの外側で)
- DatasetSpec形式に整形する
- MCP経由で投入する

**Kilnの責務:**
- DatasetSpecを検証する
- schemaを推定する
- 最適なUIを選択する
- 管理画面を生成する
- フィルタ、検索、ソート、グラフ、詳細画面を構成する

**Kilnがやらないこと:**
- データ収集(スクレイピング、API取得は全てAI側)
- HTMLをAIに書かせる / CSSをAIに書かせる / ReactをAIに書かせる

v1にあった `collect_from_url` / `collect_from_api` / `collect_from_db` は削除する。収集ツールを持った瞬間に「AIの責務=収集」という境界が崩れ、Kilnが汎用ETLツールに寄っていく。それは避けるべき方向(§15)そのもの。

## 3. 全体アーキテクチャ

```
Claude Code / Claude / その他AIエージェント
        ↓ (収集・正規化はここで完結)
MCP Server (kiln-mcp)
        ↓ push_dataset / append_records
DatasetSpec Store (PostgreSQL)
        ↓
Validator (Zod)
        ↓
Schema Inferencer
        ↓
UI Planner
        ↓
Renderer
        ↓
Next.js 閲覧画面
```

人間の役割は「見る」こと。投入はAIが行う。アップロードUIやフォームは Phase 4 まで存在しない。

## 4. DatasetSpec

### 4.1 最小構造

```json
{
  "version": "1.0",
  "kind": "dataset",
  "entity": "comment",
  "mode": "snapshot",
  "source": { "type": "mcp", "agent": "claude-code", "name": "sukikirai-comments" },
  "schema": {},
  "records": []
}
```

### 4.2 mode

- **snapshot:** 投入のたびに全置換する。例: 調査結果、ランキング、スクレイピング結果
- **append:** レコードを追記していく。`upsertKey` で重複を排除する。例: トレードログ、配信メトリクス、日次収集データ

```json
{ "mode": "append", "upsertKey": "id" }
```

v1はsnapshot前提だった。手元の実データ3種のうち2種(Zankyoトレードログ、配信アナリティクス)がappend型なので、これがないとドッグフーディングが成立しない。

### 4.3 schema定義

v1と同一。`type` / `role` / `filter` の3属性。

```json
{ "postedAt": { "type": "datetime", "role": "time", "filter": "dateRange" } }
```

schemaは省略可能。省略時はSchema Inferencerが推定する。AIがschema候補を付与した場合、推定結果とマージし、AI側を優先する。

## 5. Schema 推定ルール

**型推定:** `string` / `number` / `boolean` / `date` / `datetime` / `array` / `url` / `image` / `category` / `text` / `id`

**フィルタ自動生成:**

| 条件 | フィルタ |
| --- | --- |
| string + unique少 | select filter |
| string + 長文 | full text search |
| number | range filter |
| date / datetime | date range filter |
| boolean | toggle filter |
| array | multi select filter |
| url | link column |
| image | thumbnail column |

> 実装ノート: カテゴリは「繰り返し」を伴う。distinct 数が少なくても全件ユニークな列(コメント本文など)はカテゴリではなく自由テキストとして扱う(uniqueness ratio ガード)。日本語のように文字数が短くても情報密度の高い文章を正しく `text` に分類するための調整を入れている。

## 6. MCP Server

Kilnの正面玄関。Phase 1 で最初に作る。

### 6.1 Tools

- **push_dataset:** DatasetSpecを投入する。mode=snapshotなら全置換、新規なら作成。戻り値: dataset URL
- **append_records:** 既存datasetにレコードを追記する。upsertKeyで重複排除
- **validate_dataset_spec:** 投入せずに検証だけ行う(dry-run)。schema推定結果もプレビューで返す
- **list_datasets:** プロジェクト内のdataset一覧
- **get_dataset:** 既存datasetのspecとメタ情報を取得

5ツールのみ。v1の8ツールから収集系を削除した結果。

### 6.2 想定フロー

1. Claude Codeで調査タスクを実行
2. 結果をDatasetSpecに整形(これはAIの仕事)
3. `push_dataset` を呼ぶ
4. 返ってきたURLを開くと管理画面が既にできている

このフローの所要時間が体験のすべて。「調査完了からUI閲覧まで30秒以内」がPhase 1の合格ライン。

## 7. 自動生成されるUI

- **Phase 1:** 一覧テーブル / 全文検索 / 列別フィルタ / ソート / ページネーション / 詳細モーダル
- **Phase 2:** グラフ候補 / カード表示 / CSV/JSONエクスポート / dataset履歴(appendの推移含む)
- **Phase 3以降:** 公開ページ / APIエンドポイント

## 8. 技術スタック

**Core (framework非依存のTS packages):** DatasetSpec型定義 / Zod validator / Schema Inferencer / UI Planner

**MCP Server:** TypeScript / `@modelcontextprotocol/sdk` / ローカル(stdio)から開始、後にhomelab上でHTTP化

**Renderer / 閲覧画面:** Next.js App Router / React + Tailwind CSS / TanStack Table / Recharts / Storybook(renderer-react の開発環境として Phase 1 から)

**Database:** homelab PostgreSQL(既存インスタンスに kiln スキーマ)/ Drizzle(JSONB操作とマイグレーションの素直さでPrismaより優先)

**Auth:** Phase 1では無し(tailnet内アクセス前提)。公開する段になったらAuth.js

Storybookについて: renderer-react のコンポーネントは全て schema + records の純関数なので Storybookとの相性が構造的に良い。schema推定の各パターン(url列、image列、長文、category、append履歴等)をstoryとして固定すればそのままビジュアルリグレッションテストになる。apps/web を起動せずにコンポーネント開発が完結するため Phase 1 から入れる。

### 8.1 データ保存設計

投入されたデータは二層で保存する。

- **raw_specs (不変・追記のみ):** 投入されたDatasetSpecのペイロードをそのままJSONBで保存。用途: schema推定ロジック改良時のリプレイ、監査、デバッグ。AIが何を送ってきたかの原本が常に残る
- **datasets:** メタ情報 (entity, mode, upsertKey, 現行schema, project)
- **records (1レコード = 1行):** `dataset_id + upsert_key + data JSONB + created_at`。data列にGINインデックス。用途: append/upsert、期間フィルタ、レンジフィルタ、全文検索をすべてSQL側で実行

recordsをdataset単位の1blobにしない理由: append modeでレコードが日次増加するデータ(トレードログ等)に対して blob全体の読み書きはすぐ破綻する。フィルタとソートをPostgresに任せられることが、クライアント側実装を薄く保つ条件でもある。

raw_specsを分離する理由: Schema Inferencerは改良を重ねる前提のコンポーネント。原本が残っていれば、推定ルール変更後に全datasetを再推定できる。推定結果しか保存していないと、この再実行が不可能になる。

### 8.2 デプロイ

- **Phase 1-2:** homelab (Proxmox上のDocker)。tailnet内アクセスのみ、auth無し。MCP Serverはstdioでローカル、DBは既存Postgres。→ Vercel/Cloudflareはこの段階では不要
- **Phase 4以降(OSSデモ・公開版):** Vercel + Neon Postgres

プラットフォーム選定はワークロードに従属させる。Postgresが中心にある時点でVercel + Neonが素直(NextネイティブでedgeよりDB中心、JSONB/GIN設計がそのまま持ち込める)。Rendererは普段のNuxt/VueではなくReact/Nextで行く(TanStack Table・Recharts・管理画面系エコシステムの厚みとOSS公開時のリーチ)。core を framework非依存に切ってあるので Vue renderer は後から `@kiln/renderer-vue` として追加可能。

## 9. リポジトリ構成

```
kiln/
  apps/
    web/                  Next.js 閲覧画面
    mcp/                  MCP Server
  packages/
    core/
      dataset-spec/       型定義 + Zod schema
      validator/
      schema-inferencer/
      ui-planner/
    renderer-react/
    db/
  CHANGELOG.md            人間可読、記事素材兼用
  DESIGN.md               本書
```

プラグイン機構は Phase 4 でインターフェースを凍結するまで作らない(§15)。それまでは renderer-react 内のモジュールとして直書きする。

## 10. 開発フェーズ

### Phase 1: MCP-first MVP
DatasetSpec型定義 + Zod validator / Schema Inferencer / MCP Server (push / validate / list / get) / Postgres保存 (raw_specs + records 二層) / AutoTable + AutoFilter + AutoDetail (Next.js) / Storybook

**合格条件:** Claude Codeの調査結果を `push_dataset` で投入し、30秒以内にフィルタ付きテーブルで閲覧できる。検証データ: 好き嫌いコメントデータセット

### Phase 2: ドッグフーディング強化
append mode + upsert / グラフ候補生成 (Recharts) / エクスポート (JSON/CSV) / dataset履歴・バージョン

**合格条件:** Zankyoのトレードログを日次appendで流し込み、期間フィルタ+損益グラフが自動生成される。配信アナリティクスも同様に接続

### Phase 3: Ingestion拡張
JSON/CSVアップロードUI (v1でPhase 1だったもの) / Excel Adapter / API Adapter / DB Adapter

### Phase 4: OSS公開
Plugin Interfaceの凍結・公開 / ドキュメントサイト / 公開デモを Vercel + Neon にデプロイ / CHANGELOGからの記事化

### Phase 5: プロダクト化(条件付き)
オーガニックな需要が観測された場合のみ着手。需要がなければPhase 4で完成として運用に入る

## 11. このプロダクトの価値

データを見て意味を推定する → 意味に応じてUIを自動選択する → 人間が画面設計しなくても管理画面が成立する → AIが集めたデータを即UI化できる。

差別化の核はMCP経由の投入体験にある。CSV→テーブル生成だけならDatasette/Airtableで足りる。「エージェントの成果物が、人間が何もせずに管理画面になる」が成立して初めてAI時代のランタイムを名乗れる。だからMCPを最初に作る。

## 12. 避けるべきこと

- AIにReact/HTML/CSSを書かせる
- 自由レイアウトを最初から許す
- 汎用CMS・汎用ETLと競合する方向に寄せる
- 収集機能をKiln側に持たせる
- プラグイン設計を先に作り込みすぎる
- アップロードUIから作り始める(v1の過ち)
- 需要の観測前にプロダクト化する

## 13. 最初に書くコード

1. `packages/core/dataset-spec`: 型 + Zod schema (mode/upsertKey含む) ✅
2. `packages/core/schema-inferencer`: 推定ルール実装 + テスト ✅
3. DBスキーマ (raw_specs / datasets / records) + Drizzleマイグレーション ✅
4. `apps/mcp`: push_dataset / validate_dataset_spec (stdio) ✅
5. `packages/renderer-react`: AutoTable + Storybook ✅
6. `apps/web`: dataset一覧 + AutoTable組み込み ✅
7. 好き嫌いコメントJSONを実際に投入して合格判定 ✅

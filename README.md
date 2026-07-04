# 🔥 Kiln

**データを入れると、管理画面が出てくる。**

Kiln は、AIが収集・正規化した構造化データを受け取り、その場で管理画面一式
（テーブル・フィルタ・検索・ソート・ページネーション・詳細ビュー・グラフ候補）
を自動生成するランタイムです。陶芸の窯と同じで、形を与えるのは窯の側であって
素材ではありません。Kiln は作品ではなくインフラです。

AIの役割は **収集と正規化** まで。そこから先（検証 → schema推定 → UI設計 →
描画）は全部 Kiln がやります。Kiln はスクレイピングをしないし、AIに
React/HTML/CSS を書かせることもしません。汎用ETLツールにもしません。

> これは Phase 1（MCP-first MVP）の実装です。全体設計とロードマップは
> [`DESIGN.md`](./DESIGN.md) を参照してください。

## しくみ

```
AIエージェント（Claude Code など）      ← データの収集・正規化はここで完結
      │  push_dataset / append_records（MCP）
      ▼
kiln-mcp  ──►  Validator (Zod)  ──►  Schema Inferencer  ──►  UI Planner
      │                                                          │
      ▼                                                          ▼
Postgres（raw_specs・datasets・records）              Next.js 管理画面
```

エージェントが **DatasetSpec** を MCP サーバーに投入すると、Kiln が保存して
schema（型・role・フィルタ）を推定し、Next.js アプリがフィルタ付きの管理画面を
レンダリングします。返ってきた URL を開けば、もう画面ができています。
フィルタ・ソート・検索はすべて Postgres 側で実行されるので（§8.1）、
ブラウザ側は薄いままです。

## リポジトリ構成

| パッケージ | 中身 |
| --- | --- |
| `packages/core/dataset-spec` | `DatasetSpec` の型 + Zod schema（`mode`・`upsertKey`） |
| `packages/core/schema-inferencer` | レコードからの型 / role / フィルタ推定（§5） |
| `packages/core/validator` | spec検証 + dry-runの推定プレビュー |
| `packages/core/ui-planner` | schema → UIプラン（列・フィルタ・詳細・グラフ）の純関数 |
| `packages/db` | Drizzle schema + リポジトリ + SQL側のレコードクエリ |
| `packages/renderer-react` | `AutoTable` / `AutoFilters` / `AutoDetail` / `AutoChart` / `DatasetExplorer` + Storybook |
| `apps/mcp` | `kiln-mcp` MCPサーバー（stdio） |
| `apps/web` | Next.js App Router の閲覧画面 |

`core` と `renderer-react` は framework非依存で切ってあるので、あとから
`@kiln/renderer-vue` を追加してもこれらに手を入れずに済みます。

## クイックスタート

必要なもの: Node ≥ 20 / pnpm 10 / Postgresインスタンス

```bash
pnpm install
cp .env.example .env         # DATABASE_URL を設定

# kiln スキーマとテーブルを作成
export DATABASE_URL=postgresql://postgres@localhost:5432/kiln
pnpm build
pnpm --filter @kiln/db migrate

# 閲覧画面を起動
pnpm dev:web                 # http://localhost:3000
```

### サンプルデータを投入する

MCPサーバーをエージェントに登録します（stdio）:

```json
{
  "mcpServers": {
    "kiln": {
      "command": "node",
      "args": ["/absolute/path/to/kiln/apps/mcp/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://postgres@localhost:5432/kiln",
        "KILN_WEB_URL": "http://localhost:3000"
      }
    }
  }
}
```

そのうえで、[`examples/sukikirai-comments.json`](./examples/sukikirai-comments.json)
の中身を `push_dataset` に渡します。ツールが URL を返すので、それを開くと
フィルタ付きテーブルがもう出来上がっています。

## MCPツール

| ツール | 役割 |
| --- | --- |
| `push_dataset` | DatasetSpecを投入（snapshotは全置換、appendは`upsertKey`でupsert） |
| `append_records` | 既存datasetにレコードを追記/upsert |
| `validate_dataset_spec` | dry-run: 投入せずに検証 + 推定schemaのプレビュー |
| `list_datasets` | プロジェクト内のdataset一覧 |
| `get_dataset` | datasetのメタ情報 + 推定schemaを取得 |

Kiln には収集系ツールが **あえて** ありません。データ集めはエージェント側の
仕事であり、境界の向こう側だからです。

## 開発

```bash
pnpm test          # パッケージをビルドしてから全ユニットテスト
pnpm typecheck     # 全パッケージの型チェック
pnpm storybook     # renderer-react のコンポーネントギャラリー（localhost:6006）
```

`@kiln/db` の結合テストは `DATABASE_URL` が設定されているときだけ実行され、
未設定のときはスキップされます。

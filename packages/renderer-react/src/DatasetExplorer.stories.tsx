import type { Meta, StoryObj } from "@storybook/react";
import { DatasetExplorer } from "./DatasetExplorer.js";
import { comments, media, planFromRows, trades } from "./fixtures.js";

const meta: Meta<typeof DatasetExplorer> = {
  title: "Kiln/DatasetExplorer",
  component: DatasetExplorer,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-slate-50 p-6 dark:bg-slate-950">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof DatasetExplorer>;

/** 好き嫌いコメント — the Phase 1 acceptance dataset. Category + datetime +
 * metric + long text, with in-memory filtering/sorting/detail. */
export const Comments: Story = {
  render: () => {
    const { plan } = planFromRows(comments);
    return (
      <DatasetExplorer plan={plan} entity="comment" initialRows={comments} initialTotal={comments.length} />
    );
  },
};

/** Append-style trade log: datetime + metric drives a line chart (§4.2). */
export const TradeLog: Story = {
  render: () => {
    const { plan } = planFromRows(trades, { mode: "append" });
    return (
      <DatasetExplorer
        plan={plan}
        entity="trade"
        initialRows={trades}
        initialTotal={trades.length}
        showCharts
      />
    );
  },
};

/** URL, image (thumbnail) and boolean columns. */
export const Media: Story = {
  render: () => {
    const { plan } = planFromRows(media);
    return (
      <DatasetExplorer plan={plan} entity="item" initialRows={media} initialTotal={media.length} showCharts />
    );
  },
};

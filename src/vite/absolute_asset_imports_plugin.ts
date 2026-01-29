export const AbsoluteAssetImportsPlugin = () => {
  return {
    name: "absolute-asset-imports",

    transformIndexHtml(html: string, ctx: any) {
      if (!ctx.server) return html;

      let baseUrl = (
        ctx.server.config?.server?.origin ?? ctx.server.resolvedUrls?.local[0]
      ).replace(/\/$/, "");
      baseUrl = baseUrl.replace(/\/$/, "");

      return (
        html
          // import "/@vite/..." or "/@react-refresh"
          .replace(/(from\s+["'])\/([^"']+)/g, `$1${baseUrl}/$2`)
          // src="/src/..."
          .replace(/(src=["'])\/([^"']+)/gi, `$1${baseUrl}/$2`)
      );
    },
  };
};

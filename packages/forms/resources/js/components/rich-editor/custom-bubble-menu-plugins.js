export default async function getCustomBubbleMenuPlugins(urls) {
    const customBubbleMenuPlugins = {}

    await Promise.all(
        urls.map(async (url) => {
            try {
                const absUrl = new URL(url, document.baseURI).href
                const module = await import(absUrl)

                if (!module.default || typeof module.default !== 'function') {
                    console.error(
                        `Plugin at ${absUrl} has no default() function.`,
                    )
                    return
                }
                if (!module.pluginKey || typeof module.pluginKey !== 'string') {
                    console.error(
                        `Plugin at ${absUrl} has no exported pluginKey string.`,
                    )
                    return
                }

                customBubbleMenuPlugins[module.pluginKey] = module.default
                console.log(
                    `Loaded custom bubble menu plugin:`,
                    module.pluginKey,
                )
            } catch (error) {
                console.error(
                    `Failed loading bubble menu plugin from ${url}:`,
                    error,
                )
            }
        }),
    )

    return customBubbleMenuPlugins
}

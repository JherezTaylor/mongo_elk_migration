Source({
    name: "localmongo",
    namespace: "twitter.tweets"
}).transform({
    name: "simpletrans",
    namespace: "twitter.tweets",
    filename: "transformers/transform_normal.js",
    debug: true
}).save({
    name: "es",
    namespace:"twitter.tweets"
})

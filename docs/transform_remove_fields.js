module.exports = function(msg) {
    newdoc = _.pick(msg.data, ["id", "text", "extended_tweet", "extended_entities", "fields_removed", "display_text_range", "quoted_status", "quoted_status_id", "is_quote_status", "favorite_count", "source", "coordinates", "timestamp_ms", "in_reply_to_screen_name", "id_str", "user", "in_reply_to_user_id_str", "lang", "created_at", "filter_level", "place", "user_mentions", "media", "media_extracted", "hashtags_extracted", "user_mentions_extracted","hashtags", "urls", "preprocessed", "possibly_sensitive", "urls_extracted"]);
    console.log("transformer: " + JSON.stringify(msg.data["timestamp_ms"]));
    msg.data = newdoc
    return msg;
}

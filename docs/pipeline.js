// Transporter pipeline file
var source = mongodb({
  "uri": "mongodb://127.0.0.1:27017/twitter",
  "timeout": "30s",
  "bulk": true
})

var sink = elasticsearch({
  "uri": "http://127.0.0.1:9200/twitter",
  "timeout": "30s"
})

// In this example we use the Transformer function `pick` to retain the following
fields
var field_list = ["_id", "text", "created_at"]

t.Source("source", source, "/^tweets$/").Transform(js({
  "filename": "prep_data.js"
})).Transform(pick({
  "fields": field_list
})).Save("sink", sink)

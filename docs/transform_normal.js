module.exports = function(msg) {
    msg.data._id = msg.data._id.$oid;
    // msg.ns = "new_namespace.type"
    console.log(JSON.stringify(msg))
    return msg;
}

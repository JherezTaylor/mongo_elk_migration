# [MongoDB Elastic Stack Migration Guide](https://jhereztaylor.github.io/mongo_elk_migration/)

This guide serves as an overview of the approaches that are currently available for moving your MongoDB collections
to the Elastic Stack and keeping them in sync.

### Background info

Given that we are going to be moving data around it goes without saying that you should make a backup of your data before you even begin.
I cannot stress enough that the applications for migating the data are experimental and should be treated as such.

### Why introduce [ElasticSearch?](https://www.elastic.co/products/elasticsearch)

While MongoDB is good at storing and querying data, ElasticSearch is orders of magnitude faster when it comes to full text searches. It allows for
faster searching of all fields within a given document. Think of ElasticSearch as having your personal Google Search for your data.

### What is the [ElasticStack?](https://www.elastic.co/products)

The ElasticStack is a suite of applications that focus on gathering, transforming, searching and visualizing data. Here we are concerned with
ElasticSearch  and Kibana (Visualization front end for ElasticSearch)

### Okay but why manage two database instances?

*"Elasticsearch is commonly used in addition to another database. A database system with stronger focus on constraints, correctness and robustness,
and on being readily and transactionally updatable, has the master record - which is then asynchronously pushed to Elasticsearch."* [- source](https://www.quora.com/What-are-the-main-differences-between-ElasticSearch-and-NoSQL-DBs-like-MongoDB)

So essentially, we use MongoDB because of it's focus on ACID and ELK for searching and processing data. The goal is to have MongoDB serve
as the master dataset and any changes that we make to it would be relayed to ELK. If the size of your dataset is small then you can probably get away with
using MongoDB alone, but as your data scales up the limitations start to become apparent. I have 10 million + tweets and trying to process them with Mongo Aggregate queries is a waste of time.

### What's Kibana?

You can try out a demo [here](demo.elastic.co/).

## Enviromnent Config

The following assumes that you already have MongoDB setup and running.

#### 1. Install ElasticSearch

Follow the instructions [here](https://www.elastic.co/guide/en/elasticsearch/reference/current/deb.html) to install ElasticSearch on a single machine.
If you are installing on a machine that you would like to access external then edit `elasticsearch.yml`. It can be found with:

```bash
sudo nano /etc/elasticsearch/elasticsearch.yml
```
Within that file, comment `network.host: xxx` and replace with `network.host: 0.0.0.0`. This opens up the database to anyone who knows the IP address of your remote machine, so be sure to setup a firewall to allow connections from specific address. See [here.](https://www.digitalocean.com/community/tutorials/how-to-setup-a-firewall-with-ufw-on-an-ubuntu-and-debian-cloud-server)

It runs as a service that you can start in the same manner as MongoDB:

```bash
sudo service elasticsearch start
```

You can also follow this [setup guide](https://www.digitalocean.com/community/tutorials/how-to-install-and-configure-elasticsearch-on-ubuntu-16-04) if you need more detail.

#### 2. Install Kibana
Follow the instructions [here](https://www.elastic.co/guide/en/kibana/current/deb.html) to install Kibana.

Again, to open up the service to external connections edit `kibana.yml` with:

```bash
sudo nano /etc/kibana/kibana.yml
```

and replace `server.host:xxx` with `server.host: 0.0.0.0`. The same security concerns apply.

The following is a list of relevant files and alternate locations depending on your system.

```bash
sudo nano /lib/systemd/system/mongod.service
```
```bash
sudo nano /etc/init.d/elasticsearch
```
```bash
sudo nano /usr/lib/systemd/system/elasticsearch.service
```
```bash
sudo nano /etc/kibana/kibana.yml
```
```bash
sudo nano /etc/elasticsearch/elasticsearch.yml
```
```bash
sudo nano /etc/systemd/system/kibana.service
```

#### 3. Initializing a ReplicaSet

For both of these methods, your MongoDB instance needs to be running in ReplicaSet mode. This is where multiple servers
operate together in a master/slave configuration. You don't need to have more than one server as it can be done with a
single machine. [Follow this.](https://docs.mongodb.com/v3.0/tutorial/convert-standalone-to-replica-set/) You can stop when
you get to the section about Initializing as you don't need to do anything with shards or expanding. If you run into an error about permissions when trying to connect to the new replica set follow the steps in the answer [here.](http://stackoverflow.com/questions/15229412/unable-to-create-open-lock-file-data-mongod-lock-errno13-permission-denied)


#### 4. Creating an Admin User

Both approaches need access to the MongoDB oplog [operation log] (which is why we had to switch to ReplicaSet mode). They operate by reading all the CRUD operations and applying them to the database you want to sync.

Start a Mongo shell then enter the following:

```bash
replset:PRIMARY> db.getSiblingDB("admin").createUser({
      user: "username",
      pwd: "password",
      roles: ["backup"]
    })
```

#### 5. A note on ElasticSearch Index Mapping

In ElasticSearch an Index has the same meaning as a Database. Where in MongoDB you would have `db.collection` in ElasticSearch we have `index.type`. Whenever you push documents into ElasticSearch, it does a best effort job of figuring out what types the document fields are. This determines what fields are indexed and thus searchable. If you want to do things like geospatial or timeseries queries then you need to manually define an index mapping BEFORE you start pushing documents. A sample mapping for a tweet object is included, note that this mapping is what I created for the specific format of my tweets as I removed some fields, it should be easy enough to follow. This  [article](https://community.hortonworks.com/articles/56648/creating-a-kibana-dashboard-of-twitter-data-pushed.html) provides an overview of ELK and covers how to create your mapping. You cannot change your mapping after it has been creating without reindexing the entire Index. Start by testing with a small subset of your documents in order to ensure that you are satisfied with the results before you index your entire dataset.

You may need to create your Index before starting the sync. After creating you PUT - ing the mapping template as specified in the last article, initialize the index you want to sync with:

```bash
curl -XPUT http://localhost:9200/templatename_xxx -d '                         
{
   "settings": { "index" : {
        "refresh_interval" : "-1",
        "number_of_replicas":"0"
    	}
    }
}'
```

Where `templatename` is the name of the template we created, `twitter*` for example. This wild card applies the template to any Index we create that begins with `templatename`, the `_` is just here for illustrative purposes. We set the options in this way to speed up the initial sync as specified [here](https://www.elastic.co/guide/en/elasticsearch/reference/current/tune-for-indexing-speed.html#_disable_refresh_and_replicas_for_initial_loads). After the sync we can run the same curl command and set `refresh_interval:1s` and `number_of_replicas:1`, their default values.

## Data Migration

Assuming you were able to install everything so far, we now get to the meat of the matter. I'll remind you again to make a backup of your data.

As of this writing there are a few ways to migrate or sync your data that don't include writing your own application logic to do so. For details see
[here.](https://www.linkedin.com/pulse/5-way-sync-data-from-mongodb-es-kai-hao) I'll be focusing on [Transporter](https://github.com/compose/transporter)
and [Mongo_Connector.](https://github.com/mongodb-labs/mongo-connector)

### Mongo_Connector

Mongo_Connector is an experimental tool from the people at MongoDB. It keeps your data in sync and it also handles deletes as well. It maps the same `_id` from MongoDB to ElasticSearch. Installation and usage is fairly simple, use a `virtualenv` if you run into `sudo` issues. The repo already has a well defined wiki so I'll just link to that [here.](https://github.com/mongodb-labs/mongo-connector/wiki) I included my sample `config.json` under the docs folder.

```bash
pip install 'mongo-connector[elastic5]'
```

Use with

```bash
mongo-connector -c config.json
```

Relevant links

* [Installation](https://github.com/mongodb-labs/mongo-connector/wiki/Installation)
* [Sample Config](https://github.com/mongodb-labs/mongo-connector/blob/master/config.json)
* [Config Options](https://github.com/mongodb-labs/mongo-connector/wiki/Configuration%20Options)
* [FAQ](https://github.com/mongodb-labs/mongo-connector/wiki/FAQ)
* [Usage with ElasticSearch](https://github.com/mongodb-labs/mongo-connector/wiki/Usage%20with%20ElasticSearch)
* [Usage with Authentication](https://github.com/mongodb-labs/mongo-connector/wiki/Usage-with-Authentication)
* [Oplog Progress File](https://github.com/mongodb-labs/mongo-connector/wiki/Oplog-Progress-File)
* [#305](https://github.com/mongodb-labs/mongo-connector/issues/305)


### Transporter

Transporter has a feature that I like called Transformations. The basic idea of it is that you can modify each document you transfer. This modification includes choosing what fields to keep, combing fields and much more, all by writing simple javascript functions. An example:

```javascript
function transform(doc) {
    doc["data"]["name_type"] = doc["data"]["firstName"] + " " + doc["data"]["lastName"];
    return doc
}
```

Let's say you have a document with a field called `firstName` and `lastName`. To optimize we can create a new filed called `fullName` that is the combination of both. This is just a simple example, more details can be found [here.](https://www.compose.com/articles/transporter-0-3-0-released-transporter-streamlined/)

Grab a binary from [here](https://github.com/compose/transporter/releases) for installing Transporter. I'll include the transformation and config files that I used in the docs folder as `pipeline.js` and `prep_data.js`.

Relevant links

* [Creating an Oplog User](https://github.com/kylemclaren/mongo-transporter/wiki/Creating-a-MongoDB-oplog-user)
* [Transporter Usage Article](https://www.compose.com/articles/transporter-driving-part-2-from-db-to-db/0)
* [Transporter ES Article](https://www.compose.com/articles/transporter-maps-mongodb-to-elasticsearch/)

## Wrapping up

Okay so that covers it. Hopefully it's enough to get you started with ElasticSearch. It takes a while to get it all going but it should pay off in the end. I'm by no means an expert but if there's anything that isn't clear send me a message or open up an issue and I'll do my best to respond.

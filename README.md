# MongoDB Elastic Stack Migration Guide

This guide serves as an overview of the approaches that are currently available for moving your MongoDB collections
to the Elastic Stack and keeping them in sync.

## Background info

Given that we are going to be moving data around it goes without saying that you should a backup of your data before you even begin.
I cannot stress enough that the applications for migating the data are experimental and should be treated as such.

### Why introduce [ElasticSearch?](https://www.elastic.co/products/elasticsearch)

While MongoDB is good at storing and querying data, ElasticSearch [ES] is orders of magnitude faster when it comes to full text searches. It allows for
faster searching of all fields within a given document. Think of ES as having your personal Google Search for your data.

### What is the [ElasticStack?](https://www.elastic.co/products)

The ElasticStack is a suite of applications that focus on gathering, transforming, searching and visualizing data. Here we are concerned with
ElasticSearch  and Kibana (Visualization front end for ElasticSearch)

### Okay but why manage two database instances?

*"Elasticsearch is commonly used in addition to another database. A database system with stronger focus on constraints, correctness and robustness,
and on being readily and transactionally updatable, has the master record - which is then asynchronously pushed to Elasticsearch."* [- source](https://www.quora.com/What-are-the-main-differences-between-ElasticSearch-and-NoSQL-DBs-like-MongoDB)

So essentially, we use MongoDB because of it's focus on ACID and ELK for searching and processing data. The goal is to have MongoDB serve
as the master dataset and any changes that we make to it would be relayed to ELK. If the size of your dataset is small then you can probably get away with
using MongoDB alone, but as your data scales up the limitations start to become apparent. I have 10 million + tweets and trying to process them with Mongo Aggregate
queries is a waste of time.

### What's Kibana?

You can try out a demo [here](demo.elastic.co/).

## Getting Started

The following assumes you already have MongoDB setup and running.

### Install ElasticSearch

Follow the instructions [here](https://www.elastic.co/guide/en/elasticsearch/reference/current/deb.html) to install ES on a single machine.
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

### Install Kibana
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

### Data Migration

Assuming you got everything installed so far, we no get to the meat of the matter. I'll remind you again to make a backup of your data.

As of this writing there are a few ways to migrate or sync your data that don't include writing your own application logic to do so. For details see
[here.](https://www.linkedin.com/pulse/5-way-sync-data-from-mongodb-es-kai-hao) I'll be focusing on [Transporter](https://github.com/compose/transporter)
and [Mongo_Connector.](https://github.com/mongodb-labs/mongo-connector)

### Initializing a ReplicaSet

For both of these methods, your MongoDB instance needs to be running in ReplicaSet mode. This is where multiple servers operate together in a master/slave configuration. You don't need to have more than one server as it can be done with a single machine. [Follow this.](https://docs.mongodb.com/v3.0/tutorial/convert-standalone-to-replica-set/) You can stop when you get to the section about Initializing as you don't
need to do anything with shards or expanding.

### Creating an Admin User

Both approaches need access to the MongoDB oplog [operation log] (which is why we had to switch to ReplicaSet mode). They operate by reading all the CRUD operations and applying them to the database you want to sync.

Start a Mongo shell then enter the following:

```bash
replset:PRIMARY> db.getSiblingDB("admin").createUser({
      user: "mongo-connector-username",
      pwd: "password",
      roles: ["backup"]
    })
```

### Transporter

As of the time of this writing, Transporter is a bit broken in that it creates duplicates when updating and it does not handle deletes but I am mentioning it here for a reason. If you do use it keep in mind that it is a one way operation which takes quite a while depending on the size of your dataset. So test and plan accordingly.

The reason I mention Transporter is because of a feature it has called Transformations that I like. The basic idea of it is that you can modify each document you transfer. This modification includes choosing what fields to keep, combing fields and much more, all by writing simple javascript functions. An example:

```javascript
module.exports = function(doc) {
    doc.data._id = doc.data._id.$oid;
    doc.data.fullName = doc.data.firstName + ' ' + doc.data.lastName;
    return doc;
}
```

Let's say you have a document with a field called `firstName` and `lastName`. To optimize we can create a new filed called `fullName` that is the combination of both. This is just a simple example, more details can be found [here.](https://www.compose.com/articles/transporter-driving-part-2-from-db-to-db/)

Follow [this](https://www.digitalocean.com/community/tutorials/how-to-sync-transformed-data-from-mongodb-to-elasticsearch-with-transporter-on-ubuntu-14-04) for installing Transporter. As I mentioned before, I don't recommend using this, use only if you need to apply transformations to your data. It takes a while and any changes you make to your MongoDB collection won't be replicated. I'll include the transformation and config files that I used in the docs folder.

Relevant links

https://github.com/compose/transporter/pull/168/commits/851f3d1f10bd1458c5c84fd0070ab7cfa5631762

https://github.com/kylemclaren/mongo-transporter/wiki/Creating-a-MongoDB-oplog-user

https://www.compose.com/articles/transporter-driving-part-2-from-db-to-db/

https://www.compose.com/articles/transporter-maps-mongodb-to-elasticsearch/

https://github.com/compose/transporter/pull/168/commits/851f3d1f10bd1458c5c84fd0070ab7cfa5631762

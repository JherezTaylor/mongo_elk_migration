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
and on being readily and transactionally updatable, has the master record - which is then asynchronously pushed to Elasticsearch."* [Source](https://www.quora.com/What-are-the-main-differences-between-ElasticSearch-and-NoSQL-DBs-like-MongoDB)

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

It runs as a service that you can start in the same manner as MongoDB
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
and replace ``server.host:xxx` with `server.host: 0.0.0.0`. The same security concerns apply.

The following is a list of relevant files and alternate locations depending on your system.
```bash
sudo nano /lib/systemd/system/mongod.service
sudo nano /etc/init.d/elasticsearch
sudo nano /usr/lib/systemd/system/elasticsearch.service
sudo nano /etc/kibana/kibana.yml  
sudo nano /etc/elasticsearch/elasticsearch.yml
sudo nano /etc/systemd/system/kibana.service
```

### Data Migration

Assuming you got everything installed so far, we no get to the meat of the matter. I'll remind you again to make a backup of your data.

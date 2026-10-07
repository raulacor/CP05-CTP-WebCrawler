[BeautifulSoup](https://www.crummy.com/software/BeautifulSoup/bs4/doc/)

Running mongoDB:

```
~ brew services list | grep mongo
~ brew services start mongodb-community
~ mongosh --eval "db.runCommand({ ping: 1 })"

stop:
~ brew services stop mongodb-community
```

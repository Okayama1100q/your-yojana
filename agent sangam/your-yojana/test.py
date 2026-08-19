import sqlite3

conn = sqlite3.connect("your_yojana.db")
cursor = conn.cursor()

cursor.execute("SELECT * FROM complaints")

for row in cursor.fetchall():
    print(row)

conn.close()
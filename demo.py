from http.server import HTTPServer, SimpleHTTPRequestHandler
import ssl

# CTAP1/U2F requires serving over https
https = False

if https:
    host =('localhost', 4443)
    httpd = HTTPServer(('localhost', 4443), SimpleHTTPRequestHandler)

    httpd.socket = ssl.wrap_socket (httpd.socket,
            keyfile="localhost.key",
            certfile='localhost.crt', server_side=True)
else:
    host =('localhost' , 8080)
    httpd = HTTPServer(('localhost', 8080), SimpleHTTPRequestHandler)

print('serving on ', host)
httpd.serve_forever()

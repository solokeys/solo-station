from http.server import HTTPServer, SimpleHTTPRequestHandler
import ssl


host =('localhost' , 8080)
httpd = HTTPServer(('localhost', 8080), SimpleHTTPRequestHandler)

print('serving on ', host)
httpd.serve_forever()

/*
 * RERO angular core
 * Copyright (C) 2020 RERO
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable, of, Subject, throwError } from 'rxjs';
import { catchError, debounceTime, map, tap } from 'rxjs/operators';
import { ApiService } from '../api/api.service';
import { Error } from '../error/error';
import { resolveRefs } from './editor/utils';
import { Record } from './record';

@Injectable({
  providedIn: 'root',
})
export class RecordService {
  static readonly DEFAULT_REST_RESULTS_SIZE = 10;
  static readonly MAX_REST_RESULTS_SIZE = 9999;

  /**
   * Event for record created
   */
  private onCreate: Subject<RecordEvent> = new Subject();

  /**
   * Event for record updated
   */
  private onUpdate: Subject<RecordEvent> = new Subject();

  /**
   * Event for record deleted
   */
  private onDelete: Subject<RecordEvent> = new Subject();

  /**
   * On create observable
   * @return onCreate Subject
   */
  get onCreate$() {
    return this.onCreate.asObservable();
  }

  /**
   * On update observable
   * @return onUpdate Subject
   */
  get onUpdate$() {
    return this.onUpdate.asObservable();
  }

  /**
   * On delete observable
   * @return onDelete Subject
   */
  get onDelete$() {
    return this.onDelete.asObservable();
  }

  /**
   * Constructor
   * @param _http HttpClient
   * @param _apiService ApiService
   * @param _translateService Translate service.
   */
  constructor(
    private _http: HttpClient,
    private _apiService: ApiService,
    private _translateService: TranslateService
  ) {}

  /**
   * Get records filtered by given parameters.
   * @param type - string, type of resource
   * @param query - string, keyword to search for
   * @param page - number, return records corresponding to this page
   * @param itemsPerPage - number, number of records to return
   * @param aggregationsFilters - number, option list of filters
   * @param sort - parameter for sorting records (eg. 'mostrecent' or '-mostrecent')
   */
  getRecords(
    type: string,
    query: string = '',
    page = 1,
    itemsPerPage = RecordService.DEFAULT_REST_RESULTS_SIZE,
    aggregationsFilters: any[] = [],
    preFilters: object = {},
    headers: any = null,
    sort: string = null
  ): Observable<Record | Error> {
    // Build query string
    let httpParams = new HttpParams().set('q', query);
    httpParams = httpParams.append('page', '' + page);
    httpParams = httpParams.append('size', '' + itemsPerPage);

    if (sort) {
      httpParams = httpParams.append('sort', sort);
    }

    aggregationsFilters.forEach((filter) => {
      filter.values.forEach((value: string) => {
        httpParams = httpParams.append(filter.key, value);
      });
    });

    for (const key of Object.keys(preFilters)) {
      httpParams = httpParams.append(key, preFilters[key]);
    }

    return this._http
      .get<Record>(this._apiService.getEndpointByType(type, true) + '/', {
        params: httpParams,
        headers: this.createRequestHeaders(headers),
      })
      .pipe(catchError((error) => this.handleError(error)));
  }

  /**
   * Delete a record.
   * @param type - string, type of record
   * @param pid - string, PID to remove
   */
  delete(type: string, pid: string): Observable<void | Error> {
    return this._http
      .delete<void>(this._apiService.getEndpointByType(type, true) + '/' + pid)
      .pipe(
        tap(() => this.onDelete.next(this.createEvent(type, { pid }))),
        catchError((error) => this.handleError(error))
      );
  }

  /**
   * Get record data
   * @param type - string, type of resource
   * @param pid - string, record PID
   */
  getRecord(
    type: string,
    pid: string,
    resolve = 0,
    headers: any = {}
  ): Observable<any | Error> {
    return this._http
      .get<Record>(
        `${this._apiService.getEndpointByType(
          type,
          true
        )}/${pid}?resolve=${resolve}`,
        {
          headers: this.createRequestHeaders(headers),
        }
      )
      .pipe(catchError(error => this.handleError(error)));
  }

  /**
   * Return the schema form to generate the form based on the resource given.
   * @param recordType - string, type of the resource
   */
  getSchemaForm(recordType: string) {
    let recType = recordType.replace(/ies$/, 'y');
    recType = recType.replace(/s$/, '');
    const url = this._apiService.getSchemaFormEndpoint(recordType, true);
    return this._http.get<any>(url).pipe(
      catchError((e) => {
        if (e.status === 404) {
          return of(null);
        }
      }),
      map((data) => {
        return data;
      })
    );
  }

  /**
   * Create a new record
   * @param recordType - string, type of resource
   * @param record - object, record to create
   */
  create(recordType: string, record: object): Observable<any> {
    return this._http
      .post(this._apiService.getEndpointByType(recordType, true) + '/', record)
      .pipe(
        tap(() => this.onCreate.next(this.createEvent(recordType, { record })))
      );
  }

  /**
   * Create a new record
   * @param recordType - string, type of resource
   * @param record - object, record to create
   * @param pid - string, record PID
   */
  update(recordType: string, record: { pid: string }) {
    const url = `${this._apiService.getEndpointByType(recordType, true)}/${
      record.pid
      }`;
    return this._http
      .put(url, record)
      .pipe(
        tap(() => this.onUpdate.next(this.createEvent(recordType, { record })))
      );
  }

  /**
   * Check if a record is already registered with the same value
   * @param recordType - string, type of record
   * @param field - string, field to check
   * @param value - string, value to check
   * @param excludePid - string, PID to ignore (normally the current record we are checking)
   */
  valueAlreadyExists(
    recordType: string,
    field: string,
    value: string,
    excludePid: string
  ) {
    let query = `${field}:"${value}"`;
    if (excludePid) {
      query += ` NOT pid:${excludePid}`;
    }
    return this.getRecords(recordType, query, 1, 1).pipe(
      map((res: Record) => res.hits.total),
      map((total) => (total ? { alreadyTaken: value } : null)),
      debounceTime(1000)
    );
  }

  /**
   * Check if a record is already registered with the same value
   * @param field - FormlyFieldConfig, field to check
   * @param recordType - string, type of record
   * @param excludePid - string, PID to ignore (normally the current record we are checking)
   * @param term - string, the elaticsearch term to check the uniqueness, use field.key if not given
   * @param limitToValues - string[], limit the test to a given list of values
   * @param filter - string, additionnal es query filters
   */
  uniqueValue(
    field: FormlyFieldConfig,
    recordType: string,
    excludePid: string = null,
    term = null,
    limitToValues: string[] = [],
    filter: string = null
  ) {
    let key = field.key;
    if (term != null) {
      key = term;
    }
    const value = field.formControl.value;
    const model = resolveRefs(field.model);
    if (value == null) {
      return of(false);
    }
    if (limitToValues.length > 0 && !limitToValues.some((v) => v === value)) {
      return of(true);
    }
    let query = `${key}:${value}`;
    if (typeof value === 'string') {
      query = `${key}:"${value}"`;
    }
    if (filter) {
      const filterFn = Function('model', `return ${filter};`);
      query = `${query} AND ` + filterFn(model);
    }
    if (excludePid) {
      query += ` NOT pid:${excludePid}`;
    }
    return this.getRecords(recordType, query, 1, 1).pipe(
      map((res: Record) => res.hits.total),
      map((total) => (total ? { alreadyTaken: value } : null)),
      debounceTime(500)
    );
  }

  /**
   * Error handling during api call process.
   * @param error - HttpErrorResponse
   */
  private handleError(error: HttpErrorResponse): Observable<Error> {
    let title: string;
    let status = error.status;

    switch (status) {
      case 400: {
        title = this._translateService.instant('Bad request');
        break;
      }
      case 401: {
        title = this._translateService.instant('Unauthorized');
        break;
      }
      case 403: {
        title = this._translateService.instant('Forbidden');
        break;
      }
      case 404: {
        title = this._translateService.instant('Not found');
        break;
      }
      default: {
        title = this._translateService.instant('An error occurred');
        status = 500;
        break;
      }
    }

    return throwError({ status, title });
  }

  /**
   * Creates and returns a HttpHeader object to send to request.
   * @param headers Object containing http headers to send to request.
   */
  private createRequestHeaders(headers: any = {}) {
    return headers
      ? new HttpHeaders(headers)
      : new HttpHeaders({ 'Content-Type': 'application/json' });
  }

  /**
   * Create a message for event
   * @param resource - string
   * @param data - any
   */
  private createEvent(resource: string, data: any) {
    return { resource, data };
  }
}

export interface RecordEvent {
  resource: string;
  data: any;
}
